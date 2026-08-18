import { Config } from './config';

/**
 * Thrown when a token could not be obtained. The message is written to be shown
 * to a developer running the example, not to a learner: it names the likely
 * cause rather than saying "something went wrong".
 */
export class TokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TokenError';
  }
}

/**
 * Ask YOUR server for an embed token.
 *
 * The app sends only an assessment ID. It never sends a learner ID, and that is
 * deliberate: the server decides who the learner is, from its own session. If
 * the app could name the learner, any learner could submit results as any
 * other by editing one field.
 *
 * The returned token is short-lived (two hours), single-use, and scoped to one
 * org, one assessment and one learner. It is safe to hold in client code. Your
 * API key is not, which is why it never leaves the server.
 */
export async function mintToken(assessmentId: string): Promise<string> {
  const url = `${Config.tokenServer}/api/edpire/token`;

  // Give up rather than hang forever if the host is unreachable. Without this
  // an unreachable server looks identical to a slow one.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assessmentId }),
      signal: controller.signal,
    });
  } catch (cause) {
    throw new TokenError(
      `Could not reach the token server at ${Config.tokenServer}.\n\n` +
        'Is it running? (npm start in server/)\n' +
        'Is the device on the same network as your laptop?\n\n' +
        String(cause),
    );
  } finally {
    clearTimeout(timeout);
  }

  if (res.status === 401) {
    throw new TokenError(
      'The token server returned 401. Its resolveLearner returned null, which ' +
        'is how it rejects a request it cannot attribute to a learner.',
    );
  }

  if (!res.ok) {
    throw new TokenError(`Token server returned ${res.status}: ${await res.text()}`);
  }

  const body = (await res.json()) as { token?: unknown };
  if (typeof body.token !== 'string' || body.token.length === 0) {
    throw new TokenError(`Token server returned no token: ${JSON.stringify(body)}`);
  }

  return body.token;
}

/** One published assessment, as offered by your server's picker endpoint. */
export type AssessmentSummary = {
  id: string;
  title: string;
  exerciseCount: number | null;
};

/**
 * Ask YOUR server which assessments the learner can play.
 *
 * Your server calls Edpire with the API key and returns only titles and IDs,
 * neither of which is secret. The ID goes straight into the token request.
 */
export async function listAssessments(): Promise<AssessmentSummary[]> {
  const url = `${Config.tokenServer}/api/edpire/assessments`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  let res: Response;
  try {
    res = await fetch(url, { signal: controller.signal });
  } catch (cause) {
    throw new TokenError(
      `Could not reach the token server at ${Config.tokenServer}.\n\n` +
        'Is it running? (npm start in server/)\n' +
        'Is the device on the same network as your laptop?\n\n' +
        String(cause),
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    throw new TokenError(`Token server returned ${res.status}: ${await res.text()}`);
  }

  const body = (await res.json()) as { assessments?: AssessmentSummary[] };
  return body.assessments ?? [];
}
