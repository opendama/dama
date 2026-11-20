FROM golang:1.26-alpine AS builder
WORKDIR /src
RUN apk add --no-cache git ca-certificates
COPY go.mod go.sum* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/server ./cmd/server

FROM alpine:3.20
RUN apk add --no-cache ca-certificates
WORKDIR /app
COPY --from=builder /out/server /app/server
COPY migrations /app/migrations
# Belt-and-suspenders for QR brand badge (also embedded in the binary via brandassets).
COPY assets/brand /app/assets/brand
EXPOSE 8080
ENV DAMA_API_HOST=0.0.0.0
ENV DAMA_API_PORT=8080
# Alpine has no curl in this image by design; probe opens DB+Redis like GET /readyz.
HEALTHCHECK --interval=15s --timeout=5s --start-period=25s --retries=5 CMD ["/app/server", "-readyz"]
CMD ["/app/server"]
