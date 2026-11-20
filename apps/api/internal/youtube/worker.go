package youtube

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"dama/apps/api/internal/redisx"
)

const uploadQueueKey = "dama:youtube:upload_queue"

type UploadJob struct {
	JobID        string `json:"job_id"`
	CampaignID   string `json:"campaign_id,omitempty"`
	PublisherID  string `json:"publisher_id,omitempty"` // redis queue / worker only - handlers never return jobs
	Title        string `json:"title"`
	Description  string `json:"description"`
	LocalPath    string `json:"local_path"`              // redis queue only - handlers never return jobs
	ViewportSlot string `json:"viewport_slot,omitempty"` // desktop|tablet|mobile
	EnqueuedAt   string `json:"enqueued_at"`
}

type Worker struct {
	Pool   *Pool
	Redis  *redisx.Client
	OnDone func(ctx context.Context, job UploadJob, result *UploadResult, err error)
}

func (w *Worker) Enqueue(ctx context.Context, job UploadJob) error {
	if job.EnqueuedAt == "" {
		job.EnqueuedAt = time.Now().UTC().Format(time.RFC3339)
	}
	raw, err := json.Marshal(job)
	if err != nil {
		return err
	}
	if w.Redis != nil && w.Redis.Ready() {
		return w.Redis.RDB.LPush(ctx, uploadQueueKey, raw).Err()
	}
	// Immediate process when Redis is unavailable (local smoke).
	go w.processOne(context.Background(), job)
	return nil
}

func (w *Worker) Start(ctx context.Context) {
	if w.Pool == nil {
		return
	}
	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			default:
			}
			if w.Redis == nil || !w.Redis.Ready() {
				time.Sleep(2 * time.Second)
				continue
			}
			res, err := w.Redis.RDB.BRPop(ctx, 3*time.Second, uploadQueueKey).Result()
			if err != nil || len(res) < 2 {
				continue
			}
			var job UploadJob
			if err := json.Unmarshal([]byte(res[1]), &job); err != nil {
				log.Printf("youtube worker: bad job payload: %v", err)
				continue
			}
			w.processOne(ctx, job)
		}
	}()
	log.Println("youtube: async upload worker started")
}

func (w *Worker) processOne(ctx context.Context, job UploadJob) {
	result, err := w.Pool.UploadVideo(ctx, job.Title, job.Description, job.LocalPath)
	if w.OnDone != nil {
		w.OnDone(ctx, job, result, err)
	}
	if err != nil {
		log.Printf("youtube worker: job %s failed: %v", job.JobID, err)
		return
	}
	log.Printf("youtube worker: job %s uploaded video %s via %s", job.JobID, result.VideoID, result.Label)
}
