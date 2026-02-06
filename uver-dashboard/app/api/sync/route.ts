import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

export async function POST(request: Request) {
  const { script } = await request.json();

  // 実行を許可するスクリプトを制限（セキュリティ対策）
  const allowedScripts = ['uver_to_supabase.py', 'sns_to_supabase.py', 'sync_all_data.py'];
  
  if (!allowedScripts.includes(script)) {
    return NextResponse.json({ error: 'Invalid script' }, { status: 400 });
  }

  try {
    // Pythonスクリプトを実行。パスは環境に合わせて調整してください
    // 例: python3 scripts/uver_to_supabase.py
    const { stdout, stderr } = await execPromise(`python3 ${script}`);
    
    if (stderr) {
      console.error(`Script stderr: ${stderr}`);
    }

    return NextResponse.json({ message: `${script} executed successfully`, output: stdout });
  } catch (error: any) {
    console.error(`Execution error: ${error.message}`);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}