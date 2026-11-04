import { NextRequest, NextResponse } from 'next/server';
import { runJob, type JobName } from '@/lib/jobs';
import { makeRuntime } from '@/lib/whatsapp/factory';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const JOBS: JobName[] = ['morning', 'evening', 'weekly', 'quiet'];

export async function GET(req: NextRequest, { params }: { params: { job: string } }) {
  if (!process.env.CRON_SECRET || req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  if (!JOBS.includes(params.job as JobName)) return new NextResponse('Unknown job', { status: 404 });
  const { store, wa } = makeRuntime();
  return NextResponse.json(await runJob(params.job as JobName, store, wa));
}
