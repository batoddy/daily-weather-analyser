// Telegram Bot API sarmalayıcı. DRY_RUN=true iken hiçbir şey göndermez, konsola yazar.

export interface InlineButton {
  text: string;
  callback_data: string;
}

export type ReplyMarkup =
  | { inline_keyboard: InlineButton[][] }
  | { keyboard: { text: string; request_location?: boolean }[][]; resize_keyboard?: boolean; one_time_keyboard?: boolean }
  | { remove_keyboard: true };

export interface TgUpdate {
  update_id: number;
  message?: TgMessage;
  callback_query?: {
    id: string;
    from: { id: number };
    message?: TgMessage;
    data?: string;
  };
}

export interface TgMessage {
  message_id: number;
  chat: { id: number; type: string };
  from?: { id: number; first_name?: string; username?: string; language_code?: string };
  text?: string;
  location?: { latitude: number; longitude: number };
}

export class Telegram {
  constructor(
    private token: string,
    private dryRun: boolean,
  ) {}

  static fromEnv(env: Env): Telegram {
    return new Telegram(env.TELEGRAM_BOT_TOKEN, env.DRY_RUN === "true");
  }

  async call<T = unknown>(method: string, params: Record<string, unknown>): Promise<T> {
    if (this.dryRun) {
      console.log(`[DRY_RUN] ${method}`, JSON.stringify(params, null, 1));
      return { message_id: 0 } as T;
    }
    const res = await fetch(`https://api.telegram.org/bot${this.token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(10_000),
    });
    const data = (await res.json()) as { ok: boolean; result: T; description?: string };
    if (!data.ok) throw new Error(`Telegram ${method}: ${data.description}`);
    return data.result;
  }

  send(chatId: number, text: string, reply_markup?: ReplyMarkup) {
    return this.call<TgMessage>("sendMessage", {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
      reply_markup,
    });
  }

  edit(chatId: number, messageId: number, text: string, reply_markup?: ReplyMarkup) {
    return this.call("editMessageText", { chat_id: chatId, message_id: messageId, text, parse_mode: "HTML", reply_markup });
  }

  answerCallback(id: string, text?: string) {
    return this.call("answerCallbackQuery", { callback_query_id: id, text });
  }
}
