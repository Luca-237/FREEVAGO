import mongoose from 'mongoose';

let connected = false;

export async function connectDB() {
    if (connected) return mongoose.connection;

    const uri = process.env.MONGO_URI;
    if (!uri) {
        throw new Error('Falta MONGO_URI en el .env de ms3-armado');
    }

    await mongoose.connect(uri);
    connected = true;
    console.log('[ms3-armado] Conectado a MongoDB');
    return mongoose.connection;
}
