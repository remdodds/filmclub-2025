#!/usr/bin/env node

/**
 * Local Testing Setup Script
 *
 * This script sets up the Firebase emulator with test data:
 * 1. Creates club config that allows voting any day except Sunday
 * 2. Optionally opens a voting round for testing
 * 3. Optionally adds test films
 *
 * Usage:
 *   node scripts/setup-local-testing.js
 */

const admin = require('firebase-admin');
const bcrypt = require('bcryptjs');

// Initialize Firebase Admin for emulator
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8888';

admin.initializeApp({
  projectId: 'demo-test',
});

const db = admin.firestore();

async function setupClubConfig() {
  console.log('Setting up club configuration...');

  // Hash the test password
  const passwordHash = await bcrypt.hash('testpassword', 10);

  const config = {
    clubName: 'Test Film Club',
    timezone: 'Europe/London',
    // Voting opens Monday 00:00, closes Saturday 23:59
    // This allows voting Mon-Sat (any day except Sunday)
    votingSchedule: {
      openDay: 1,      // Monday
      openTime: '00:00',
      closeDay: 6,     // Saturday
      closeTime: '23:59'
    },
    passwordHash,
    createdAt: new Date()
  };

  await db.collection('config').doc('club').set(config);
  console.log('✓ Club config created');
  console.log('  - Voting allowed: Monday-Saturday (any day except Sunday)');
  console.log('  - Test password: testpassword');
}

async function addTestFilms() {
  console.log('\nAdding test films...');

  const films = [
    { title: 'The Godfather', year: 1972, addedBy: 'test-visitor-1' },
    { title: 'Pulp Fiction', year: 1994, addedBy: 'test-visitor-2' },
    { title: 'The Shawshank Redemption', year: 1994, addedBy: 'test-visitor-3' },
    { title: 'Inception', year: 2010, addedBy: 'test-visitor-1' }
  ];

  for (const film of films) {
    await db.collection('films').add({
      ...film,
      status: 'nominated',
      createdAt: new Date()
    });
    console.log(`  ✓ Added: ${film.title} (${film.year})`);
  }
}

async function openVotingRound() {
  console.log('\nOpening voting round...');

  // Check if there's already an open round
  const openRounds = await db
    .collection('votingRounds')
    .where('status', '==', 'open')
    .limit(1)
    .get();

  if (!openRounds.empty) {
    console.log('  ⚠ Voting round already open');
    return;
  }

  // Get nominated films count
  const filmsSnapshot = await db
    .collection('films')
    .where('status', '==', 'nominated')
    .get();

  const candidateCount = filmsSnapshot.size;

  if (candidateCount === 0) {
    console.log('  ⚠ No nominated films. Add films first.');
    return;
  }

  // Create voting round that closes in 7 days
  const now = new Date();
  const closesAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  await db.collection('votingRounds').add({
    status: 'open',
    openedAt: now,
    closesAt,
    candidateCount,
    createdAt: now
  });

  console.log('  ✓ Voting round opened');
  console.log(`  - Candidates: ${candidateCount}`);
  console.log(`  - Closes: ${closesAt.toISOString()}`);
}

async function main() {
  console.log('🎬 Film Club - Local Testing Setup\n');
  console.log('Make sure Firebase emulators are running!');
  console.log('(Run: firebase emulators:start)\n');

  try {
    await setupClubConfig();
    await addTestFilms();
    await openVotingRound();

    console.log('\n✅ Setup complete!');
    console.log('\nNext steps:');
    console.log('1. Start the dev server: npm run dev');
    console.log('2. Login with password: testpassword');
    console.log('3. Start testing voting functionality!');
    console.log('\nAPI Base URL: http://localhost:5555/filmclub-demo-test/us-central1/api');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('\nMake sure:');
    console.error('1. Firebase emulators are running');
    console.error('2. You are in the project root directory');
    console.error('3. Dependencies are installed: npm install');
    process.exit(1);
  }
}

main();
