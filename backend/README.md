# Kwanza ERP - Backend Server

This is the backend server for Kwanza ERP. Run this on your **main server PC** (the "heart" of your system).

## Requirements

- Node.js 18+ 
- PostgreSQL 15+

## Installation

```bash
cd backend
npm install
```

## Environment Setup

Create a `.env` file:

```env
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/kwanza_erp
PORT=3000
JWT_SECRET=your-super-secret-key-change-this
```

## Database Setup

1. Install PostgreSQL
2. Create database: `createdb kwanza_erp`
3. Run migrations: `npm run migrate`

## Start Server

```bash
npm start
```

Your server will run at `http://192.168.x.x:3000` (your local IP)

## All other computers

On other PCs, open a browser and go to:
```
http://[SERVER_IP]:3000/app
```

Replace `[SERVER_IP]` with your server's local IP address (e.g., 192.168.1.50)
