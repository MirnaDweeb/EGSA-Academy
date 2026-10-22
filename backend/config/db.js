const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/egsa_academy';
  try {
    await mongoose.connect(uri);
    console.log('[DB] MongoDB connected:', uri);

    // Ensure nationalId index is sparse to allow registration without immediate national ID
    try {
      const db = mongoose.connection.db;
      const indexes = await db.collection('users').indexes();
      const natIdx = indexes.find((i) => i.name === 'nationalId_1');
      if (natIdx && !natIdx.sparse) {
        await db.collection('users').dropIndex('nationalId_1');
        await db.collection('users').createIndex({ nationalId: 1 }, { unique: true, sparse: true });
        console.log('[DB] Synced users.nationalId index to unique & sparse.');
      }
    } catch {
      // Ignore if collection not created yet
    }
  } catch (err) {
    console.error('[DB] Connection error:', err.message);
    process.exit(1);
  }
}

module.exports = connectDB;
