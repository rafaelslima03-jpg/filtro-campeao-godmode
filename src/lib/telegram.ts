/**
 * Módulo de integração com Telegram
 * Envia alertas do Radar Automático Pro para o Telegram
 */

export async function sendTelegramAlert(message: string): Promise<void> {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN
    const chatId = process.env.TELEGRAM_CHAT_ID

    // Validar se as variáveis de ambiente estão configuradas
    if (!botToken || !chatId) {
      console.warn('⚠️ Telegram não configurado: TELEGRAM_BOT_TOKEN ou TELEGRAM_CHAT_ID ausentes')
      return
    }

    // Enviar mensagem via API do Telegram
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error('❌ Erro ao enviar mensagem ao Telegram:', errorData)
      return
    }

    console.log('✅ Alerta enviado ao Telegram com sucesso')
  } catch (error) {
    // Não quebrar o sistema se houver erro no Telegram
    console.error('❌ Erro ao enviar alerta ao Telegram:', error)
  }
}
