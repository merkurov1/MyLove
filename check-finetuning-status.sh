#!/bin/bash
# Check fine-tuning job status

source /workspaces/MyLove/.env.local 2>/dev/null || true

JOB_ID="ftjob-tB0zXBxdkWNg62V7udZhut5N"

echo "=== Fine-Tuning Job Status ==="
echo "Job ID: $JOB_ID"
echo ""

curl -s https://api.openai.com/v1/fine_tuning/jobs/$JOB_ID \
  -H "Authorization: Bearer $OPENAI_API_KEY" | jq '.'

echo ""
echo "=== Quick Status ==="
curl -s https://api.openai.com/v1/fine_tuning/jobs/$JOB_ID \
  -H "Authorization: Bearer $OPENAI_API_KEY" | jq '{
    status: .status,
    fine_tuned_model: .fine_tuned_model,
    trained_tokens: .trained_tokens,
    estimated_finish: .estimated_finish
  }'

echo ""
echo "To monitor continuously:"
echo "  watch -n 30 ./check-finetuning-status.sh"
