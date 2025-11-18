// Script to drop the unique index on NRIC field
// This allows multiple patients to have the same NRIC or empty NRIC values

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env.local') });

async function dropNricIndex() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI not found in environment variables');
    }

    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    const patientsCollection = db.collection('patients');

    // Get existing indexes
    console.log('\nCurrent indexes on patients collection:');
    const indexes = await patientsCollection.indexes();
    indexes.forEach(index => {
      console.log(`  - ${index.name}:`, JSON.stringify(index.key));
    });

    // Drop the unique nric index
    console.log('\nDropping nric_1 unique index...');
    try {
      await patientsCollection.dropIndex('nric_1');
      console.log('✓ Successfully dropped nric_1 index');
    } catch (error) {
      if (error.code === 27 || error.message.includes('index not found')) {
        console.log('Index nric_1 does not exist (already dropped or never created)');
      } else {
        throw error;
      }
    }

    // Verify the index was dropped
    console.log('\nRemaining indexes on patients collection:');
    const remainingIndexes = await patientsCollection.indexes();
    remainingIndexes.forEach(index => {
      console.log(`  - ${index.name}:`, JSON.stringify(index.key));
    });

    console.log('\n✓ Script completed successfully!');
    console.log('NRIC field can now have duplicate values or empty strings.');

  } catch (error) {
    console.error('Error dropping NRIC index:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the script
dropNricIndex();
