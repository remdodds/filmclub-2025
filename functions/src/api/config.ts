/**
 * Config API Endpoints
 *
 * Club configuration and setup
 */

import { Request, Response } from 'express';
import { db } from '../utils/db';
import { hashPassword, verifyPassword } from '../utils/auth';
import { validatePassword } from '../utils/auth.logic';

/**
 * Club configuration interface
 */
export interface ClubConfig {
  clubName: string;
  timezone: string;
  votingSchedule: {
    openDay: number; // 0-6 (Sunday-Saturday)
    openTime: string; // HH:mm format
    closeDay: number; // 0-6 (Sunday-Saturday)
    closeTime: string; // HH:mm format
    winnerDisplayEndDay?: number | null; // 0-6 (Sunday-Saturday), optional
    winnerDisplayEndTime?: string | null; // HH:mm format, optional
  };
}

/**
 * POST /config/setup
 * One-time club setup (can only be run once)
 *
 * Request body:
 * {
 *   clubName: string,
 *   password: string,
 *   timezone: string,
 *   votingSchedule: {
 *     openDay: number,
 *     openTime: string,
 *     closeDay: number,
 *     closeTime: string
 *   }
 * }
 *
 * Response:
 * {
 *   success: true,
 *   config: ClubConfig
 * }
 */
export async function setupClub(req: Request, res: Response): Promise<void> {
  try {
    const { clubName, password, timezone, votingSchedule } = req.body;

    // Check if already configured
    const configDoc = await db.collection('config').doc('club').get();
    if (configDoc.exists) {
      res.status(409).json({ error: 'Club is already configured. Setup can only be run once.' });
      return;
    }

    // Validate required fields
    if (!clubName || !password || !timezone || !votingSchedule) {
      res.status(400).json({
        error: 'Missing required fields: clubName, password, timezone, votingSchedule',
      });
      return;
    }

    // Validate password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      res.status(400).json({ error: passwordValidation.error });
      return;
    }

    // Validate voting schedule
    if (
      typeof votingSchedule.openDay !== 'number' ||
      typeof votingSchedule.closeDay !== 'number' ||
      votingSchedule.openDay < 0 ||
      votingSchedule.openDay > 6 ||
      votingSchedule.closeDay < 0 ||
      votingSchedule.closeDay > 6
    ) {
      res.status(400).json({
        error: 'Invalid voting schedule days. Must be 0-6 (Sunday-Saturday)',
      });
      return;
    }

    // Validate time format (HH:mm)
    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(votingSchedule.openTime) || !timeRegex.test(votingSchedule.closeTime)) {
      res.status(400).json({
        error: 'Invalid time format. Use HH:mm (e.g., "18:00")',
      });
      return;
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create config
    const config: ClubConfig = {
      clubName,
      timezone,
      votingSchedule,
    };

    // Save to Firestore
    await db.collection('config').doc('club').set({
      ...config,
      passwordHash,
      createdAt: new Date(),
    });

    res.status(201).json({
      success: true,
      config,
    });
  } catch (error) {
    console.error('Setup club error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /config
 * Get public club configuration (without password)
 *
 * Response:
 * {
 *   config: ClubConfig | null
 * }
 */
export async function getConfig(req: Request, res: Response): Promise<void> {
  try {
    const configDoc = await db.collection('config').doc('club').get();

    if (!configDoc.exists) {
      res.status(200).json({ config: null });
      return;
    }

    const data = configDoc.data()!;

    const config: ClubConfig = {
      clubName: data.clubName,
      timezone: data.timezone,
      votingSchedule: data.votingSchedule,
    };

    res.status(200).json({ config });
  } catch (error) {
    console.error('Get config error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * PUT /config/voting-schedule
 * Update voting schedule (requires authentication)
 *
 * Request body:
 * {
 *   votingSchedule: {
 *     openDay: number,
 *     openTime: string,
 *     closeDay: number,
 *     closeTime: string
 *   }
 * }
 *
 * Response:
 * {
 *   success: true,
 *   config: ClubConfig
 * }
 */
export async function updateVotingSchedule(req: Request, res: Response): Promise<void> {
  try {
    const { votingSchedule } = req.body;

    // Check if club is configured
    const configDoc = await db.collection('config').doc('club').get();
    if (!configDoc.exists) {
      res.status(404).json({ error: 'Club not configured. Run setup first.' });
      return;
    }

    // Validate required fields
    if (!votingSchedule) {
      res.status(400).json({
        error: 'Missing required field: votingSchedule',
      });
      return;
    }

    // Validate voting schedule
    if (
      typeof votingSchedule.openDay !== 'number' ||
      typeof votingSchedule.closeDay !== 'number' ||
      votingSchedule.openDay < 0 ||
      votingSchedule.openDay > 6 ||
      votingSchedule.closeDay < 0 ||
      votingSchedule.closeDay > 6
    ) {
      res.status(400).json({
        error: 'Invalid voting schedule days. Must be 0-6 (Sunday-Saturday)',
      });
      return;
    }

    // Validate time format (HH:mm)
    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(votingSchedule.openTime) || !timeRegex.test(votingSchedule.closeTime)) {
      res.status(400).json({
        error: 'Invalid time format. Use HH:mm (e.g., "18:00")',
      });
      return;
    }

    // Validate optional winner display end fields
    const hasEndDay = votingSchedule.winnerDisplayEndDay != null;
    const hasEndTime = votingSchedule.winnerDisplayEndTime != null;
    if (hasEndDay !== hasEndTime) {
      res.status(400).json({ error: 'winnerDisplayEndDay and winnerDisplayEndTime must both be set or both be null' });
      return;
    }
    if (hasEndDay) {
      if (
        typeof votingSchedule.winnerDisplayEndDay !== 'number' ||
        votingSchedule.winnerDisplayEndDay < 0 ||
        votingSchedule.winnerDisplayEndDay > 6
      ) {
        res.status(400).json({ error: 'Invalid winnerDisplayEndDay. Must be 0-6 (Sunday-Saturday)' });
        return;
      }
      if (!timeRegex.test(votingSchedule.winnerDisplayEndTime as string)) {
        res.status(400).json({ error: 'Invalid winnerDisplayEndTime format. Use HH:mm (e.g., "21:00")' });
        return;
      }
    }

    // Update voting schedule
    await db.collection('config').doc('club').update({
      votingSchedule,
      updatedAt: new Date(),
    });

    // Return updated config
    const updatedDoc = await db.collection('config').doc('club').get();
    const data = updatedDoc.data()!;

    const config: ClubConfig = {
      clubName: data.clubName,
      timezone: data.timezone,
      votingSchedule: data.votingSchedule,
    };

    res.status(200).json({
      success: true,
      config,
    });
  } catch (error) {
    console.error('Update voting schedule error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * PUT /admin/change-password
 * Change the club password (admin only)
 *
 * Request body:
 * {
 *   currentPassword: string,
 *   newPassword: string
 * }
 *
 * Response:
 * {
 *   success: true
 * }
 */
export async function changePassword(req: Request, res: Response): Promise<void> {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: 'Missing required fields: currentPassword, newPassword' });
      return;
    }

    const configDoc = await db.collection('config').doc('club').get();
    if (!configDoc.exists) {
      res.status(404).json({ error: 'Club not configured.' });
      return;
    }

    const data = configDoc.data()!;
    const isValid = await verifyPassword(currentPassword, data.passwordHash);
    if (!isValid) {
      res.status(401).json({ error: 'Current password is incorrect.' });
      return;
    }

    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      res.status(400).json({ error: passwordValidation.error });
      return;
    }

    const passwordHash = await hashPassword(newPassword);
    await db.collection('config').doc('club').update({
      passwordHash,
      updatedAt: new Date(),
    });

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * PATCH /admin/club-name
 * Update the club name (admin only)
 *
 * Request body:
 * {
 *   clubName: string
 * }
 *
 * Response:
 * {
 *   success: true,
 *   clubName: string
 * }
 */
export async function updateClubName(req: Request, res: Response): Promise<void> {
  try {
    const { clubName } = req.body;
    const trimmed = typeof clubName === 'string' ? clubName.trim() : '';

    if (!trimmed) {
      res.status(400).json({ error: 'Missing required field: clubName' });
      return;
    }

    const configDoc = await db.collection('config').doc('club').get();
    if (!configDoc.exists) {
      res.status(404).json({ error: 'Club not configured.' });
      return;
    }

    await db.collection('config').doc('club').update({
      clubName: trimmed,
      updatedAt: new Date(),
    });

    res.status(200).json({ success: true, clubName: trimmed });
  } catch (error) {
    console.error('Update club name error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
