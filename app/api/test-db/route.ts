import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const result = await query('SELECT NOW() as current_time');
    return NextResponse.json({ 
      success: true, 
      message: 'Database connection successful',
      timestamp: (result.rows[0] as any).current_time
    });

  } catch (error) {
    console.error('Database connection error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error
      },
      { status: 500 }
    );
  }
}