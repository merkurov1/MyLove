#!/bin/bash
# Проверка статуса fine-tuning job

source <(grep -v '^#' .env.local | grep '=' | sed 's/^/export /')

JOB_ID="ftjob-tfJEinsWUcqGtXm1DPRd6111"

echo "🔍 Checking fine-tuning job status..."
echo "Job ID: $JOB_ID"
echo ""

curl https://api.openai.com/v1/fine_tuning/jobs/$JOB_ID \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  2>/dev/null | python3 -m json.tool

echo ""
echo "---"
echo ""
echo "💡 Статусы:"
echo "  - validating_files: Проверка данных"
echo "  - queued: В очереди на обучение"
echo "  - running: Обучается (10-30 минут)"
echo "  - succeeded: ✅ Готово!"
echo "  - failed: ❌ Ошибка"
echo ""
echo "Запускайте этот скрипт каждые 5 минут чтобы проверить статус:"
echo "  bash scripts/check-finetuning-status.sh"
