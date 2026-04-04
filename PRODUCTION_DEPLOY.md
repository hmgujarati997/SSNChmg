# SSNC Production Deployment Guide (2-Core, 8GB RAM, 100GB Disk)

## Performance Optimizations Already Applied
- **MongoDB connection pool**: maxPoolSize=100, minPoolSize=10
- **MongoDB indexes**: All hot query paths indexed (leaderboard aggregations, references, registrations, badges)
- **GZip compression**: All API responses >500 bytes are compressed
- **QR codes optimized**: ~90KB each (1200 users = ~108MB disk vs previous 2.76GB)
- **Memory leak fix**: WhatsApp job tracker auto-cleans completed jobs after 1 hour

## Uvicorn Workers (CRITICAL)
The preview environment runs 1 worker. For production with 2 cores:

```bash
# In your supervisor/systemd config, change:
uvicorn server:app --host 0.0.0.0 --port 8001 --workers 3
# Formula: (2 * CPU_cores) + 1 = 5, but 3 is safer for 8GB RAM
# Remove --reload flag in production
```

## Nginx Reverse Proxy (Recommended)
Use nginx in front of uvicorn for static file serving and connection handling:

```nginx
upstream backend {
    server 127.0.0.1:8001;
}

server {
    listen 80;
    
    # Serve static QR files directly via nginx (bypasses Python)
    location /api/uploads/ {
        alias /path/to/backend/uploads/;
        expires 1h;
        add_header Cache-Control "public, immutable";
    }

    # Serve React build
    location / {
        root /path/to/frontend/build;
        try_files $uri /index.html;
    }

    # Proxy API to uvicorn
    location /api/ {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
    }

    # Gzip
    gzip on;
    gzip_types application/json text/css application/javascript;
    gzip_min_length 500;
    
    # Client body size for file uploads
    client_max_body_size 10M;
}
```

## MongoDB Tuning
```bash
# /etc/mongod.conf
storage:
  wiredTiger:
    engineConfig:
      cacheSizeGB: 2  # 25% of 8GB RAM

# Ensure mongod uses the WiredTiger storage engine (default in MongoDB 4+)
```

## Resource Estimates for 1200 Users
| Resource | Estimate |
|----------|----------|
| QR files on disk | ~108 MB |
| User uploads (photos/logos) | ~500 MB (estimated) |
| MongoDB data | ~200 MB |
| RAM (uvicorn 3 workers) | ~600 MB |
| RAM (MongoDB) | ~2 GB |
| RAM (Total headroom) | ~5 GB free |
| Disk total | <5 GB used |

## React Build for Production
```bash
cd frontend
yarn build
# Serve the /build folder via nginx, not yarn start
```

## Monitoring
```bash
# Check MongoDB connections
mongosh --eval "db.serverStatus().connections"

# Check uvicorn memory
ps aux | grep uvicorn

# Monitor live
htop
```
