# syntax=docker/dockerfile:1
# E02: static settlement binary on a small base (alpine, for the nc health check).
FROM golang:1.22-bookworm AS build
WORKDIR /src
COPY apps/settlement/go.mod apps/settlement/go.sum ./
RUN go mod download
COPY apps/settlement/ ./
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/settlement ./cmd/settlement

FROM alpine:3.20
RUN adduser -D -H -u 10001 settlement
COPY --from=build /out/settlement /usr/local/bin/settlement
USER settlement
EXPOSE 8091
ENTRYPOINT ["/usr/local/bin/settlement"]
CMD ["daemon"]
