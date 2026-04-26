sed -i 's/^DATABASE_URL=.*/DATABASE_URL="file:.\/dev.db"/' ~/app/.env
sed -i 's/^DATABASE_URL=.*/DATABASE_URL="file:..\/..\/prisma\/dev.db"/' ~/app/dashboard/.env
pm2 restart all
