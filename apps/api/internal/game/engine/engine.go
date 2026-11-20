// Package engine implements FMJD International Draughts (10x10).
package engine

import (
	"encoding/json"
	"fmt"
)

const (
	BoardSize      = 10
	PlayerOne      = 1
	PlayerTwo      = 2
	Draw           = 0
	FiftyMoveLimit = 50
)

var allDiagonals = [][2]int{{-1, -1}, {-1, 1}, {1, -1}, {1, 1}}

// Piece is a JSON-serializable board cell: {"p":1|2,"k":bool}.
type Piece struct {
	P int  `json:"p"`
	K bool `json:"k"`
}

// Board is a 10x10 grid; nil cells are empty (or light squares).
type Board [BoardSize][BoardSize]*Piece

// Move is a single legal transition (possibly multi-capture as one sequence).
type Move struct {
	FromRow       int      `json:"-"`
	FromCol       int      `json:"-"`
	ToRow         int      `json:"-"`
	ToCol         int      `json:"-"`
	From          [2]int   `json:"from"`
	To            [2]int   `json:"to"`
	Captures      [][2]int `json:"captures"`
	Promotes      bool     `json:"promotes"`
	KingsCaptured int      `json:"kings_captured"`
	StartsAsKing  bool     `json:"starts_as_king"`
	MenCaptured   int      `json:"men_captured"`
}

func (m *Move) CaptureCount() int { return len(m.Captures) }

func (m *Move) syncCoords() {
	m.From = [2]int{m.FromRow, m.FromCol}
	m.To = [2]int{m.ToRow, m.ToCol}
}

// State is the authoritative game position.
type State struct {
	Variant        string           `json:"variant"`
	Size           int              `json:"size"`
	Board          Board            `json:"board"`
	Turn           int              `json:"turn"`
	Mode           string           `json:"mode"`
	MustContinue   *[2]int          `json:"must_continue"`
	MoveCount      int              `json:"move_count"`
	HalfmoveClock  int              `json:"halfmove_clock"`
	PositionCounts map[string]int   `json:"position_counts"`
	MoveHistory    []map[string]any `json:"move_history"`
	Draw           bool             `json:"draw"`
	DrawReason     *string          `json:"draw_reason"`
	// ForcedOutcome ends the match outside normal rules (e.g. abandon/resign/clock flag).
	ForcedOutcome *int `json:"forced_outcome,omitempty"`
	// EndReason is set when ForcedOutcome is applied (e.g. "clock_flag"); empty for board wins.
	EndReason          string  `json:"end_reason,omitempty"`
	Player1ID          *string `json:"player1_id,omitempty"`
	Player2ID          *string `json:"player2_id,omitempty"`
	AIPlayer           *int    `json:"ai_player,omitempty"`
	AISearchDepth      int     `json:"ai_search_depth,omitempty"`
	TimeControlSeconds int     `json:"time_control_seconds,omitempty"`
	Rated              bool    `json:"rated,omitempty"`
	// Authoritative match clock (DB match_clock). Clients interpolate; server decides flag-fall.
	ClockActive           bool  `json:"clock_active,omitempty"`
	ClockIncrementSeconds int   `json:"clock_increment_seconds,omitempty"`
	ClockP1RemainingMs    int64 `json:"clock_p1_remaining_ms,omitempty"`
	ClockP2RemainingMs    int64 `json:"clock_p2_remaining_ms,omitempty"`
	ClockLastTickUnixMs   int64 `json:"clock_last_tick_unix_ms,omitempty"`
	// Pause freezes the armed clock and blocks moves until resume or expiry.
	Paused               bool   `json:"paused,omitempty"`
	PausedAtUnixMs       int64  `json:"paused_at_unix_ms,omitempty"`
	PauseExpiresAtUnixMs int64  `json:"pause_expires_at_unix_ms,omitempty"`
	PausedByUserID       string `json:"paused_by_user_id,omitempty"`
	// PauseKind is "player" (seat, timed) or "official" (organizer/admin, manual resume).
	PauseKind string `json:"pause_kind,omitempty"`
	// Official pause metadata (empty for player pause).
	PauseReasonKey        string `json:"pause_reason_key,omitempty"`
	PauseReasonLabel      string `json:"pause_reason_label,omitempty"`
	PauseNote             string `json:"pause_note,omitempty"`
	PauseActorRole        string `json:"pause_actor_role,omitempty"`
	PauseActorDisplayName string `json:"pause_actor_display_name,omitempty"`
}

// Pause kind / actor role constants (server-authoritative; clients display only).
const (
	PauseKindPlayer   = "player"
	PauseKindOfficial = "official"
	PauseActorPlayer  = "player"
	PauseActorAdmin   = "admin"
	PauseActorOrg     = "organizer"
)

func IsPlayable(row, col int) bool {
	return row >= 0 && row < BoardSize && col >= 0 && col < BoardSize && (row+col)%2 == 1
}

func promoteRow(player int) int {
	if player == PlayerOne {
		return 0
	}
	return BoardSize - 1
}

func manForwardDirs(player int) [][2]int {
	if player == PlayerOne {
		return [][2]int{{-1, -1}, {-1, 1}}
	}
	return [][2]int{{1, -1}, {1, 1}}
}

func pieceAt(board *Board, row, col int) *Piece {
	if !IsPlayable(row, col) {
		return nil
	}
	return board[row][col]
}

func cloneBoard(src *Board) Board {
	var dst Board
	for r := 0; r < BoardSize; r++ {
		for c := 0; c < BoardSize; c++ {
			if src[r][c] != nil {
				p := *src[r][c]
				dst[r][c] = &p
			}
		}
	}
	return dst
}

func cloneState(s *State) *State {
	data, _ := json.Marshal(s)
	var out State
	_ = json.Unmarshal(data, &out)
	if out.PositionCounts == nil {
		out.PositionCounts = map[string]int{}
	}
	return &out
}

// InitialBoard places pieces using FMJD dark-square setup for the given setup row count.
// setupRows must come from platform_settings.board_rules (typically 4 for FMJD 10x10).
func InitialBoard(setupRows int) (Board, error) {
	if setupRows <= 0 || setupRows*2 >= BoardSize {
		return Board{}, fmt.Errorf("invalid setup_rows for board size %d", BoardSize)
	}
	var board Board
	for row := 0; row < BoardSize; row++ {
		for col := 0; col < BoardSize; col++ {
			if !IsPlayable(row, col) {
				continue
			}
			if row < setupRows {
				board[row][col] = &Piece{P: PlayerTwo, K: false}
			} else if row >= BoardSize-setupRows {
				board[row][col] = &Piece{P: PlayerOne, K: false}
			}
		}
	}
	return board, nil
}

// InitialState creates a fresh FMJD game using database-backed setup rows / variant label.
// aiDepth must already be validated against the database feature-flag allow-list
// by the API layer. The engine stores the value as-is (no hard-coded remap).
func InitialState(mode string, aiDepth, setupRows int, variant string) (*State, error) {
	board, err := InitialBoard(setupRows)
	if err != nil {
		return nil, err
	}
	if variant == "" {
		return nil, fmt.Errorf("variant required")
	}
	state := &State{
		Variant:        variant,
		Size:           BoardSize,
		Board:          board,
		Turn:           PlayerOne,
		Mode:           mode,
		MustContinue:   nil,
		MoveCount:      0,
		HalfmoveClock:  0,
		PositionCounts: map[string]int{},
		MoveHistory:    []map[string]any{},
		Draw:           false,
	}
	if mode == "ai" {
		ai := PlayerTwo
		state.AIPlayer = &ai
		state.AISearchDepth = aiDepth
	}
	return state, nil
}

func positionHash(state *State) string {
	parts := make([]byte, 0, 256)
	for row := 0; row < BoardSize; row++ {
		for col := 0; col < BoardSize; col++ {
			cell := state.Board[row][col]
			if cell == nil {
				continue
			}
			kind := "m"
			if cell.K {
				kind = "k"
			}
			parts = append(parts, []byte(fmt.Sprintf("%d:%d:%d%s;", row, col, cell.P, kind))...)
		}
	}
	must := ""
	if state.MustContinue != nil {
		must = fmt.Sprintf("|m%d:%d", state.MustContinue[0], state.MustContinue[1])
	}
	return string(parts) + fmt.Sprintf("|t%d%s", state.Turn, must)
}

func DetectDraw(state *State) *string {
	if state.Draw {
		return state.DrawReason
	}
	if state.HalfmoveClock >= FiftyMoveLimit {
		r := "fifty_move"
		return &r
	}
	key := positionHash(state)
	if state.PositionCounts[key] >= 3 {
		r := "repetition"
		return &r
	}
	return nil
}

func countKingsInCaptures(board *Board, captures [][2]int) int {
	total := 0
	for _, c := range captures {
		cell := pieceAt(board, c[0], c[1])
		if cell != nil && cell.K {
			total++
		}
	}
	return total
}

func makeCaptureMove(board *Board, startRow, startCol, toRow, toCol int, captured [][2]int, promotes bool) Move {
	kings := countKingsInCaptures(board, captured)
	start := pieceAt(board, startRow, startCol)
	startsAsKing := start != nil && start.K
	m := Move{
		FromRow:       startRow,
		FromCol:       startCol,
		ToRow:         toRow,
		ToCol:         toCol,
		Captures:      append([][2]int{}, captured...),
		Promotes:      promotes,
		KingsCaptured: kings,
		StartsAsKing:  startsAsKing,
		MenCaptured:   max(0, len(captured)-kings),
	}
	m.syncCoords()
	return m
}

func fmjdCaptureRank(m Move) [5]int {
	prom := 0
	if m.Promotes {
		prom = 1
	}
	uncrowned := 1
	if m.StartsAsKing {
		uncrowned = 0
	}
	return [5]int{m.CaptureCount(), m.KingsCaptured, m.MenCaptured, prom, uncrowned}
}

func rankGTE(a, b [5]int) bool {
	for i := 0; i < 5; i++ {
		if a[i] != b[i] {
			return a[i] > b[i]
		}
	}
	return true
}

func rankEQ(a, b [5]int) bool {
	return a == b
}

func filterMaximalCaptures(moves []Move) []Move {
	if len(moves) == 0 {
		return moves
	}
	best := fmjdCaptureRank(moves[0])
	for _, m := range moves[1:] {
		r := fmjdCaptureRank(m)
		if rankGTE(r, best) && !rankEQ(r, best) {
			best = r
		}
	}
	out := make([]Move, 0, len(moves))
	for _, m := range moves {
		if rankEQ(fmjdCaptureRank(m), best) {
			out = append(out, m)
		}
	}
	return out
}

func containsCapture(captured [][2]int, row, col int) bool {
	for _, c := range captured {
		if c[0] == row && c[1] == col {
			return true
		}
	}
	return false
}

func manCaptureSequences(board *Board, row, col, player, startRow, startCol int, captured [][2]int, promoted bool) []Move {
	piece := pieceAt(board, row, col)
	if piece == nil || piece.P != player || piece.K {
		return nil
	}

	var sequences []Move
	foundJump := false

	for _, d := range allDiagonals {
		dr, dc := d[0], d[1]
		midR, midC := row+dr, col+dc
		landR, landC := row+2*dr, col+2*dc
		if !IsPlayable(landR, landC) {
			continue
		}
		mid := pieceAt(board, midR, midC)
		land := pieceAt(board, landR, landC)
		if mid == nil || mid.P == player || land != nil {
			continue
		}
		if containsCapture(captured, midR, midC) {
			continue
		}

		foundJump = true
		nextBoard := cloneBoard(board)
		nextBoard[row][col] = nil
		nextBoard[midR][midC] = nil
		promotesNow := landR == promoteRow(player)
		promotedFlag := promoted || promotesNow
		nextBoard[landR][landC] = &Piece{P: player, K: promotesNow}

		nextCaptured := append(append([][2]int{}, captured...), [2]int{midR, midC})
		var deeper []Move
		if promotesNow {
			deeper = kingCaptureSequences(&nextBoard, landR, landC, player, startRow, startCol, nextCaptured, promotedFlag)
		} else {
			deeper = manCaptureSequences(&nextBoard, landR, landC, player, startRow, startCol, nextCaptured, promotedFlag)
		}
		if len(deeper) > 0 {
			sequences = append(sequences, deeper...)
		} else {
			sequences = append(sequences, makeCaptureMove(board, startRow, startCol, landR, landC, nextCaptured, promotedFlag))
		}
	}

	if !foundJump && len(captured) > 0 {
		sequences = append(sequences, makeCaptureMove(board, startRow, startCol, row, col, captured, promoted))
	}
	return sequences
}

func kingCaptureSequences(board *Board, row, col, player, startRow, startCol int, captured [][2]int, promoted bool) []Move {
	piece := pieceAt(board, row, col)
	if piece == nil || piece.P != player || !piece.K {
		return nil
	}

	var sequences []Move
	foundJump := false

	for _, d := range allDiagonals {
		dr, dc := d[0], d[1]
		scanR, scanC := row+dr, col+dc
		for IsPlayable(scanR, scanC) && pieceAt(board, scanR, scanC) == nil {
			scanR += dr
			scanC += dc
		}
		if !IsPlayable(scanR, scanC) {
			continue
		}
		target := pieceAt(board, scanR, scanC)
		if target == nil || target.P == player || containsCapture(captured, scanR, scanC) {
			continue
		}

		landR, landC := scanR+dr, scanC+dc
		for IsPlayable(landR, landC) && pieceAt(board, landR, landC) == nil {
			foundJump = true
			nextBoard := cloneBoard(board)
			nextBoard[row][col] = nil
			nextBoard[scanR][scanC] = nil
			nextBoard[landR][landC] = &Piece{P: player, K: true}

			nextCaptured := append(append([][2]int{}, captured...), [2]int{scanR, scanC})
			deeper := kingCaptureSequences(&nextBoard, landR, landC, player, startRow, startCol, nextCaptured, promoted)
			if len(deeper) > 0 {
				sequences = append(sequences, deeper...)
			} else {
				sequences = append(sequences, makeCaptureMove(board, startRow, startCol, landR, landC, nextCaptured, promoted))
			}
			landR += dr
			landC += dc
		}
	}

	if !foundJump && len(captured) > 0 {
		sequences = append(sequences, makeCaptureMove(board, startRow, startCol, row, col, captured, promoted))
	}
	return sequences
}

func captureSequencesForPiece(board *Board, row, col, player int) []Move {
	piece := pieceAt(board, row, col)
	if piece == nil || piece.P != player {
		return nil
	}
	if piece.K {
		return kingCaptureSequences(board, row, col, player, row, col, nil, false)
	}
	return manCaptureSequences(board, row, col, player, row, col, nil, false)
}

func kingStepMoves(board *Board, row, col, player int) []Move {
	piece := pieceAt(board, row, col)
	if piece == nil || piece.P != player || !piece.K {
		return nil
	}
	var moves []Move
	for _, d := range allDiagonals {
		nr, nc := row+d[0], col+d[1]
		for IsPlayable(nr, nc) && pieceAt(board, nr, nc) == nil {
			m := Move{FromRow: row, FromCol: col, ToRow: nr, ToCol: nc, Captures: [][2]int{}}
			m.syncCoords()
			moves = append(moves, m)
			nr += d[0]
			nc += d[1]
		}
	}
	return moves
}

func manStepMoves(board *Board, row, col, player int) []Move {
	piece := pieceAt(board, row, col)
	if piece == nil || piece.P != player || piece.K {
		return nil
	}
	var moves []Move
	for _, d := range manForwardDirs(player) {
		nr, nc := row+d[0], col+d[1]
		if IsPlayable(nr, nc) && pieceAt(board, nr, nc) == nil {
			m := Move{
				FromRow:  row,
				FromCol:  col,
				ToRow:    nr,
				ToCol:    nc,
				Captures: [][2]int{},
				Promotes: nr == promoteRow(player),
			}
			m.syncCoords()
			moves = append(moves, m)
		}
	}
	return moves
}

func legalMovesForPiece(board *Board, row, col, player int) []Move {
	captures := captureSequencesForPiece(board, row, col, player)
	if len(captures) > 0 {
		return filterMaximalCaptures(captures)
	}
	piece := pieceAt(board, row, col)
	if piece == nil || piece.P != player {
		return nil
	}
	if piece.K {
		return kingStepMoves(board, row, col, player)
	}
	return manStepMoves(board, row, col, player)
}

// LegalMoves returns all FMJD-legal moves for the side to move.
func LegalMoves(state *State) []Move {
	board := &state.Board
	player := state.Turn
	if state.MustContinue != nil {
		r, c := state.MustContinue[0], state.MustContinue[1]
		caps := legalMovesForPiece(board, r, c, player)
		out := make([]Move, 0, len(caps))
		for _, m := range caps {
			if m.CaptureCount() > 0 {
				out = append(out, m)
			}
		}
		return out
	}

	var captureMoves, stepMoves []Move
	for row := 0; row < BoardSize; row++ {
		for col := 0; col < BoardSize; col++ {
			piece := pieceAt(board, row, col)
			if piece == nil || piece.P != player {
				continue
			}
			caps := captureSequencesForPiece(board, row, col, player)
			if len(caps) > 0 {
				captureMoves = append(captureMoves, caps...)
			} else {
				stepMoves = append(stepMoves, manStepMoves(board, row, col, player)...)
				stepMoves = append(stepMoves, kingStepMoves(board, row, col, player)...)
			}
		}
	}
	if len(captureMoves) > 0 {
		return filterMaximalCaptures(captureMoves)
	}
	return stepMoves
}

func finalizeMoveTransition(state *State, board *Board, move Move, player int) {
	if move.CaptureCount() > 0 {
		remaining := legalMovesForPiece(board, move.ToRow, move.ToCol, player)
		hasMore := false
		for _, m := range remaining {
			if m.CaptureCount() > 0 {
				hasMore = true
				break
			}
		}
		if hasMore {
			mc := [2]int{move.ToRow, move.ToCol}
			state.MustContinue = &mc
			return
		}
	}

	state.MustContinue = nil
	if move.CaptureCount() > 0 {
		state.HalfmoveClock = 0
	} else {
		state.HalfmoveClock++
	}
	if state.PositionCounts == nil {
		state.PositionCounts = map[string]int{}
	}
	key := positionHash(state)
	state.PositionCounts[key]++
	if reason := DetectDraw(state); reason != nil {
		state.Draw = true
		state.DrawReason = reason
	}
	if player == PlayerOne {
		state.Turn = PlayerTwo
	} else {
		state.Turn = PlayerOne
	}
}

// ApplyMove applies a validated move and returns the next state.
func ApplyMove(state *State, move Move) (*State, error) {
	next := cloneState(state)
	board := &next.Board
	player := next.Turn
	piece := board[move.FromRow][move.FromCol]
	if piece == nil {
		return nil, fmt.Errorf("no piece at source")
	}

	board[move.FromRow][move.FromCol] = nil
	for _, c := range move.Captures {
		board[c[0]][c[1]] = nil
	}
	isKing := piece.K || move.Promotes
	board[move.ToRow][move.ToCol] = &Piece{P: player, K: isKing}

	next.MoveCount++
	entry := map[string]any{
		"from":           move.From,
		"to":             move.To,
		"captures":       move.Captures,
		"promotes":       move.Promotes,
		"kings_captured": move.KingsCaptured,
		"starts_as_king": move.StartsAsKing,
		"men_captured":   move.MenCaptured,
		"player":         player,
		"board_after":    PublicBoard(board),
	}
	next.MoveHistory = append(next.MoveHistory, entry)
	finalizeMoveTransition(next, board, move, player)
	return next, nil
}

// FindMove looks up a legal move by from/to coordinates.
func FindMove(state *State, fromRow, fromCol, toRow, toCol int) *Move {
	for _, m := range LegalMoves(state) {
		if m.FromRow == fromRow && m.FromCol == fromCol && m.ToRow == toRow && m.ToCol == toCol {
			cp := m
			return &cp
		}
	}
	return nil
}

func CountPieces(board *Board, player int) int {
	total := 0
	for row := 0; row < BoardSize; row++ {
		for col := 0; col < BoardSize; col++ {
			cell := board[row][col]
			if cell != nil && cell.P == player {
				total++
			}
		}
	}
	return total
}

// GameOutcome returns PlayerOne, PlayerTwo, Draw, or nil if ongoing.
func GameOutcome(state *State) *int {
	if state.ForcedOutcome != nil {
		v := *state.ForcedOutcome
		return &v
	}
	if state.Draw {
		d := Draw
		return &d
	}
	if CountPieces(&state.Board, PlayerOne) == 0 {
		w := PlayerTwo
		return &w
	}
	if CountPieces(&state.Board, PlayerTwo) == 0 {
		w := PlayerOne
		return &w
	}
	if len(LegalMoves(state)) == 0 {
		if state.Turn == PlayerOne {
			w := PlayerTwo
			return &w
		}
		w := PlayerOne
		return &w
	}
	return nil
}

// PublicBoard serializes nil-safe board cells for JSON APIs.
func PublicBoard(board *Board) [][]any {
	out := make([][]any, BoardSize)
	for r := 0; r < BoardSize; r++ {
		out[r] = make([]any, BoardSize)
		for c := 0; c < BoardSize; c++ {
			if board[r][c] != nil {
				out[r][c] = board[r][c]
			} else {
				out[r][c] = nil
			}
		}
	}
	return out
}
