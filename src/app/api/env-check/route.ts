import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? null,
    SUPABASE_ANON_KEY_HEAD:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.slice(0, 10) ?? null,
  });
}
