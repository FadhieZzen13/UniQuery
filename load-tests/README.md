# k6 Load Testing — UniQuery

Performance and load testing scripts for the UniQuery platform using [k6](https://k6.io/).

## Prerequisites

### Install k6

**Windows (Chocolatey):**
```powershell
choco install k6
```

**Windows (winget):**
```powershell
winget install k6 --source winget
```

**macOS (Homebrew):**
```bash
brew install k6
```

**Linux (apt):**
```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D68
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

## Available Scripts

### Search Performance Test (TC-IDX-02)

Tests the search endpoint under load with 10 concurrent virtual users for 30 seconds.

**Run against local dev server:**
```bash
k6 run load-tests/search-performance.js
```

**Run against staging (when available):**
```bash
k6 run -e BASE_URL=https://staging.uniquery.app load-tests/search-performance.js
```

**Run with custom VU count and duration:**
```bash
k6 run --vus 50 --duration 60s load-tests/search-performance.js
```

## Performance Thresholds

| Metric | Threshold | Description |
|--------|-----------|-------------|
| `http_req_duration` | p(95) < 2000ms | 95th percentile response time |
| `search_duration` | p(95) < 1500ms | Custom search-specific metric |
| `search_failures` | rate < 1% | Maximum acceptable failure rate |

## Test Data

The load test cycles through 10 different academic search queries to simulate realistic usage patterns:
- Binary search, data structures, machine learning, database normalization, etc.

## CI Integration

k6 tests are intended to run manually or in a dedicated performance testing pipeline. They are NOT included in the PR-triggered CI pipeline to avoid blocking PRs with performance fluctuations.

For CI integration (future), consider:
```yaml
- name: Run k6 Load Tests
  uses: grafana/k6-action@v0.3.1
  with:
    filename: load-tests/search-performance.js
```
