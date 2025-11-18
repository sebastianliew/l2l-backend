// Script to drop the unique index on email field
// This allows multiple patients (family members) to share the same email address

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env.local') });

async function dropEmailIndex() {
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
      console.log(`  - ${index.name}:`, JSON.stringify(index.key), index.unique ? '(UNIQUE)' : '');
    });

    // Drop the unique email index
    console.log('\nDropping email_1 unique index...');
    try {
      await patientsCollection.dropIndex('email_1');
      console.log('✓ Successfully dropped email_1 index');
    } catch (error) {
      if (error.code === 27 || error.message.includes('index not found')) {
        console.log('Index email_1 does not exist (already dropped or never created)');
      } else {
        throw error;
      }
    }

    // Verify the index was dropped
    console.log('\nRemaining indexes on patients collection:');
    const remainingIndexes = await patientsCollection.indexes();
    remainingIndexes.forEach(index => {
      console.log(`  - ${index.name}:`, JSON.stringify(index.key), index.unique ? '(UNIQUE)' : '');
    });

    console.log('\n✓ Script completed successfully!');
    console.log('Email field can now have duplicate values (family members can share emails).');

  } catch (error) {
    console.error('Error dropping email index:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the script
dropEmailIndex();
