// Upload dataset to OpenAI and start fine-tuning job (using native fetch)
const fs = require('fs');
const FormData = require('form-data');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.error('[ERROR] OPENAI_API_KEY not set');
  process.exit(1);
}

async function uploadAndFineTune() {
  try {
    // Step 1: Upload the training file
    console.log('[UPLOAD] Uploading finetuning-dataset.jsonl to OpenAI...');
    
    const form = new FormData();
    form.append('purpose', 'fine-tune');
    form.append('file', fs.createReadStream('finetuning-dataset.jsonl'));
    
    const uploadResponse = await fetch('https://api.openai.com/v1/files', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        ...form.getHeaders()
      },
      body: form
    });
    
    if (!uploadResponse.ok) {
      const error = await uploadResponse.json();
      console.error('[ERROR] Upload failed:', error);
      process.exit(1);
    }
    
    const uploadData = await uploadResponse.json();
    console.log('[SUCCESS] File uploaded:', uploadData.id);
    console.log('File details:', JSON.stringify(uploadData, null, 2));
    
    // Step 2: Create fine-tuning job
    console.log('\n[FINE-TUNING] Creating fine-tuning job...');
    
    const fineTuneResponse = await fetch('https://api.openai.com/v1/fine_tuning/jobs', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        training_file: uploadData.id,
        model: 'gpt-4o-mini-2024-07-18',
        hyperparameters: {
          n_epochs: 3
        },
        suffix: 'merkurov-rag'
      })
    });
    
    if (!fineTuneResponse.ok) {
      const error = await fineTuneResponse.json();
      console.error('[ERROR] Fine-tuning job creation failed:', JSON.stringify(error, null, 2));
      process.exit(1);
    }
    
    const fineTuneData = await fineTuneResponse.json();
    console.log('[SUCCESS] Fine-tuning job created!');
    console.log('Job ID:', fineTuneData.id);
    console.log('Status:', fineTuneData.status);
    console.log('\nFull details:', JSON.stringify(fineTuneData, null, 2));
    
    console.log('\n=== NEXT STEPS ===');
    console.log('1. Monitor job status:');
    console.log(`   curl https://api.openai.com/v1/fine_tuning/jobs/${fineTuneData.id} \\`);
    console.log(`     -H "Authorization: Bearer $OPENAI_API_KEY"`);
    console.log('\n2. List all jobs:');
    console.log(`   curl https://api.openai.com/v1/fine_tuning/jobs \\`);
    console.log(`     -H "Authorization: Bearer $OPENAI_API_KEY"`);
    console.log('\n3. After completion (~10-30 minutes), the model will be:');
    console.log(`   ft:gpt-4o-mini-2024-07-18:personal:merkurov-rag:xxxxx`);
    console.log('\n4. Use it in app/api/chat/route.ts by changing model name');
    
  } catch (error) {
    console.error('[FATAL ERROR]', error.message);
    console.error(error);
    process.exit(1);
  }
}

uploadAndFineTune();
