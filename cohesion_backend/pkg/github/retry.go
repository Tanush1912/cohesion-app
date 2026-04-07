package github

import (
	"context"
	"math"
	"math/rand"
	"net/http"
	"time"

	gh "github.com/google/go-github/v68/github"
)

const (
	maxRetries     = 3
	baseDelay      = 500 * time.Millisecond
	maxDelay       = 30 * time.Second
	jitterFraction = 0.3
)

// withRetry executes fn with exponential backoff and jitter.
// It retries on transient errors (5xx, rate limits, network errors).
func withRetry[T any](ctx context.Context, fn func() (T, *gh.Response, error)) (T, *gh.Response, error) {
	var result T
	var resp *gh.Response
	var err error

	for attempt := 0; attempt <= maxRetries; attempt++ {
		result, resp, err = fn()
		if err == nil {
			return result, resp, nil
		}

		if !isRetryable(resp, err) {
			return result, resp, err
		}

		delay := backoffDelay(attempt, resp)

		select {
		case <-ctx.Done():
			return result, resp, ctx.Err()
		case <-time.After(delay):
		}
	}

	return result, resp, err
}

func isRetryable(resp *gh.Response, err error) bool {
	if err == nil {
		return false
	}

	// Rate limit exceeded
	if _, ok := err.(*gh.RateLimitError); ok {
		return true
	}
	if _, ok := err.(*gh.AbuseRateLimitError); ok {
		return true
	}

	// Server errors (5xx)
	if resp != nil && resp.StatusCode >= http.StatusInternalServerError {
		return true
	}

	// 403 can be a secondary rate limit
	if resp != nil && resp.StatusCode == http.StatusForbidden {
		return true
	}

	return false
}

func backoffDelay(attempt int, resp *gh.Response) time.Duration {
	// If GitHub tells us when to retry, respect that
	if resp != nil && resp.Rate.Reset.After(time.Now()) {
		waitUntil := time.Until(resp.Rate.Reset.Time)
		if waitUntil > 0 && waitUntil < maxDelay {
			return waitUntil + jitter(waitUntil)
		}
	}

	// Exponential backoff with jitter
	delay := time.Duration(float64(baseDelay) * math.Pow(2, float64(attempt)))
	if delay > maxDelay {
		delay = maxDelay
	}
	return delay + jitter(delay)
}

func jitter(base time.Duration) time.Duration {
	return time.Duration(float64(base) * jitterFraction * rand.Float64())
}
