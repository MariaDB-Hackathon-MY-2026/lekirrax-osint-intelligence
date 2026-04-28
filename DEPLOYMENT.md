# Deployment Checklist: LekirraX Recommendation System

## 1. Database Setup

- [ ] Run `node scripts/migrate_recommendations.js` on the production database.
- [ ] Ensure indexes are created on `user_interactions(user_id, item_id)` for fast lookups.
- [ ] Set up a read-replica for the recommendation engine if traffic exceeds 1k RPS.

## 2. Environment Variables

- [ ] Set `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` in production environment.
- [ ] (Optional) Configure Redis for `recommendation_cache` if using a distributed cluster.

## 3. Monitoring & Alerting (Prometheus/Grafana)

### Dashboards

- **P95 Latency**: Monitor `/api/recommendations` endpoint. Alert if > 100ms.
- **Cache Hit Rate**: Percentage of requests served from `recommendation_cache`.
- **Interaction Throughput**: Monitor `POST /api/interactions` volume.

### Alerting Rules

- **High Latency**: `http_request_duration_seconds{path="/api/recommendations", quantile="0.95"} > 0.1`
- **DB Connection Failures**: `mariadb_pool_errors_total > 0`
- **Zero Recommendations**: `rate(recommendations_returned_total[5m]) == 0` (Signifies engine failure).

## 4. Performance Tuning

- [ ] Enable Query Caching in MariaDB.
- [ ] Use `pm2` or `kubernetes` for process management with multiple instances.
- [ ] Implement a background job to warm the cache for active users.

## 5. Security

- [ ] Ensure `userId` is validated against a session/JWT (Current implementation is open for demo).
- [ ] Rate limit `/api/interactions` to prevent interaction spam.

