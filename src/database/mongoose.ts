import mongoose from 'mongoose';
import logger from '../structures/Logger';

const MONGO_URI = process.env.MONGODB_URI || "mongodb+srv://sidharhth123pupu_db_user:mjxlalzFJOOoQoZ5@cluster0.y5oxyz0.mongodb.net/dimscord?retryWrites=true&w=majority&appName=Cluster0";

export async function connectMongoose(): Promise<typeof mongoose> {
    try {
        mongoose.set('strictQuery', false);
        const conn = await mongoose.connect(MONGO_URI, {
            autoIndex: true,
            serverSelectionTimeoutMS: 5000,
        });
        logger.info('[MongoDB] Successfully connected to MongoDB Atlas (AWS Mumbai)!');
        return conn;
    } catch (err: any) {
        logger.error('[MongoDB] Connection error:', err.message);
        throw err;
    }
}
