# Vultr VPS Setup Guide for EC Tower Backend

## Prerequisites

- Vultr account with Ubuntu instance created
- SSH credentials (username: `root`, password, IP address)
- University SFTP credentials (server hostname, username, password)
- Git installed on your local machine

---

## Step 1: Connect to Your VPS

Open **Terminal** (Windows: Git Bash or PowerShell) and run:

```bash
ssh root@YOUR_VULTR_IP
```

Replace `YOUR_VULTR_IP` with your actual IP address (e.g., `ssh root@192.168.1.100`).

**Enter your password** when prompted (characters won't appear while typing - this is normal).

### Troubleshooting SSH Connection

**"Connection refused" error:**

- Wait 2-3 minutes after creating the instance (Vultr takes time to provision)
- Check Vultr dashboard → Instances → Confirm status is **"Running"**

**Verbose mode for debugging:**

```bash
ssh -v root@YOUR_VULTR_IP
```

---

## Step 2: Update System and Install Node.js

Copy-paste these commands **one at a time**:

```bash
# Update system packages
apt update && apt upgrade -y

# Install Node.js 18.x (LTS version)
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Verify installations
node --version   # Should show v18.x
npm --version    # Should show 9.x or 10.x
```

---

## Step 3: Clone Backend Repository

```bash
# Create application directory
mkdir -p ~/ec-tower-backend
cd ~/ec-tower-backend

# Clone the repository
git clone https://github.com/ashish-codebase/ec-tower-realtime-monitor.git .

# Navigate to backend directory
cd backend
```

---

## Step 4: Install Dependencies

```bash
# Install Node.js packages
npm install
```

This installs Express, ssh2-sftp-client, and other required packages.

---

## Step 5: Configure SFTP Credentials

```bash
# Create .env file with template
cat > .env << EOF
# SFTP Configuration (replace with YOUR university SFTP credentials)
SFTP_HOST=your-sftp-server.com
SFTP_PORT=22
SFTP_USER=your-username
SFTP_PASSWORD=your-password

# Backend
PORT=3001
EOF

# Edit the file to add your actual SFTP details
nano .env
```

**Important:** Replace these placeholders:

- `your-sftp-server.com` → Your university SFTP hostname (e.g., `sftp.university.edu`)
- `your-username` → Your SFTP username
- `your-password` → Your SFTP password

**To edit with nano:**

- Make your changes
- Press `Ctrl+O` → `Enter` to save
- Press `Ctrl+X` to exit

---

## Step 6: Start Backend Service

### Test Run (Optional)

```bash
# Run once to test (press Ctrl+C to stop)
node server.js
```

Check logs for:

- `[SFTP] No SFTP_HOST set, skipping download` (if TEST_MODE not set)
- `[Scheduler] Fetching 10 sites...`
- `[Scheduler] Done: X ok, Y failed`

### Install PM2 (Process Manager)

```bash
# Install PM2 globally
npm install -g pm2

# Start backend with PM2
pm2 start server.js --name "ec-tower-backend"

# Save PM2 process list (survives reboots)
pm2 save

# Setup PM2 to start on system boot
pm2 startup

# Check status
pm2 status

# View logs
pm2 logs ec-tower-backend

# View recent logs
pm2 logs ec-tower-backend --lines 50
```

---

## Step 7: Test Backend Endpoints

Open a **new terminal window** (keep SSH connection open) and run:

```bash
# Test sites endpoint
curl http://localhost:3001/api/sites

# Test data endpoint
curl http://localhost:3001/api/data/Boulder.json?limit=5

# Test fetch endpoint (triggers manual fetch)
curl -X POST http://localhost:3001/api/fetch
```

**Expected responses:**

**Sites endpoint:**

```json
{"sites":[{"name":"Baggs","ip":"107.89.240.97"},...]}
```

**Data endpoint:**

```json
[{"timestamp":...,"sensor":"MET","name":"WindSpeed","readings":[...]}]
```

**Fetch endpoint:**

```json
{"message":"Fetch started","status":"running"}
```

---

## Step 8: Update Vercel Frontend

In your **local project** (not the VPS), update `src/components/Dashboard.tsx`:

```typescript
// Find this line:
const RENDER_BACKEND = 'https://ec-tower-backend.onrender.com';

// Change to:
const RENDER_BACKEND = 'http://YOUR_VULTR_IP:3001';
```

Replace `YOUR_VULTR_IP` with your Vultr IP address.

**Commit and push:**

```bash
git add -A
git commit -m "Update backend URL to Vultr VPS"
git push origin main
```

Vercel will auto-deploy within 1-2 minutes.

---

## Step 9: Verify End-to-End

1. **Check Vultr dashboard** → Instance is running
2. **Check PM2 status:** `pm2 status`
3. **Check Vercel deployment:** Visit https://ec-tower-realtime-monitor.vercel.app
4. **Open browser console** (F12) - should see no errors
5. **Dashboard should load** with site data

---

## Maintenance Commands

```bash
# View logs
pm2 logs ec-tower-backend

# View recent logs only
pm2 logs ec-tower-backend --lines 100

# Restart backend
pm2 restart ec-tower-backend

# Stop backend
pm2 stop ec-tower-backend

# Update code and redeploy
cd ~/ec-tower-backend/backend
git pull
npm install
pm2 restart ec-tower-backend

# Check disk usage
df -h
du -sh data/

# Check SFTP upload files
ls -lh data/*.json

# Monitor system resources
htop
```

---

## Troubleshooting

### Backend not starting

```bash
# Check PM2 status
pm2 status

# View detailed logs
pm2 logs ec-tower-backend --lines 100

# Check for syntax errors
node -c server.js
```

### Can't connect to EC towers

```bash
# Test TCP connection to a tower
nc -zv 166.230.26.67 50311

# If connection times out, check:
# - Vultr firewall settings (allow outbound)
# - Tower IPs are publicly accessible
# - Remove TEST_MODE from .env for production
```

### SFTP upload failing

```bash
# Test SFTP connection manually
sftp your-username@sftp-server.com

# Check SFTP logs
pm2 logs ec-tower-backend | grep SFTP

# Verify .env file has correct credentials
cat .env | grep SFTP
```

### Port 3001 not accessible from outside

```bash
# Check if backend is listening
netstat -tlnp | grep 3001

# Or
ss -tlnp | grep 3001

# Check Vultr firewall settings
# Go to Vultr dashboard → Firewall → Ensure port 3001 is open
```

### VPS running out of memory

```bash
# Check memory usage
free -h

# Monitor with htop
sudo apt install htop
htop

# Check what's using memory
ps aux --sort=-%mem | head -20
```

### Disk space running low

```bash
# Check disk usage
df -h

# Check data directory size
du -sh ~/ec-tower-backend/backend/data/

# Clean up old logs
pm2 delete ec-tower-backend
pm2 save
pm2 startup
pm2 start server.js --name "ec-tower-backend"
```

---

## Security Recommendations

1. **Change default SSH port** (optional but recommended)
   
   ```bash
   sudo nano /etc/ssh/sshd_config
   # Change Port 22 to Port 2222 (or another port)
   sudo systemctl restart sshd
   ```

2. **Setup SSH keys** instead of password
   
   ```bash
   # Generate key pair on your local machine
   ssh-keygen -t ed25519
   
   # Copy public key to VPS
   ssh-copy-id root@YOUR_VULTR_IP
   ```

3. **Enable UFW firewall**
   
   ```bash
   sudo ufw allow 22/tcp
   sudo ufw allow 3001/tcp
   sudo ufw enable
   sudo ufw status
   ```

4. **Regular system updates**
   
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

5. **Monitor logs regularly**
   
   ```bash
   pm2 logs ec-tower-backend
   ```

---

## Cost

**Vultr Pricing:**

- Smallest instance: **$5/month** (1 vCPU, 1GB RAM, 25GB storage)
- Recommended: **$12/month** (2 vCPUs, 4GB RAM, 80GB storage)

For your use case (20MB data + code), the $5/month instance is sufficient.

---

## Next Steps

1. ✅ Connect to VPS via SSH
2. ✅ Install Node.js and dependencies
3. ✅ Configure SFTP credentials
4. ✅ Start backend with PM2
5. ✅ Update Vercel frontend URL
6. 🔄 Test end-to-end
7. 🔄 Remove TEST_MODE for real tower data (if towers are reachable)
8. 🔄 Setup HTTPS (optional, using Certbot + Nginx)

---

## Support Resources

- **Vultr Documentation:** https://www.vultr.com/docs/
- **PM2 Documentation:** https://pm2.keymetrics.io/docs/usage/quick-start/
- **Node.js Documentation:** https://nodejs.org/en/docs/
- **Ubuntu Server Guide:** https://ubuntu.com/server/docs

---

## Quick Reference

```bash
# Connect
ssh root@YOUR_VULTR_IP

# Check backend status
pm2 status

# View logs
pm2 logs ec-tower-backend

# Restart backend
pm2 restart ec-tower-backend

# Update code
cd ~/ec-tower-backend/backend
git pull
npm install
pm2 restart ec-tower-backend

# Check SFTP files
ls -lh data/*.json

# Test endpoints
curl http://localhost:3001/api/sites
curl http://localhost:3001/api/data/Boulder.json?limit=5
```
