const mongoose = require('mongoose');

async function dropIndex() {
  try {
    await mongoose.connect('mongodb://localhost:27017/Leeetcode', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    const db = mongoose.connection.db;
    const collection = db.collection('users');

    const indexes = await collection.indexes();
    console.log('Current indexes:', indexes);

    const indexName = 'problemSolved_1';
    const indexExists = indexes.some(index => index.name === indexName);

    if (indexExists) {
      await collection.dropIndex(indexName);
      console.log(`Index '${indexName}' dropped successfully.`);
    } else {
      console.log(`Index '${indexName}' does not exist.`);
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error dropping index:', error);
    process.exit(1);
  }
}

dropIndex();
