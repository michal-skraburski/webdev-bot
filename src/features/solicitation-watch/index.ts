import {
  EmbedBuilder,
  Events,
  type GuildMember,
  type Message,
  PermissionFlagsBits,
  type TextChannel,
} from 'discord.js';
import { createEvent } from '@/common/events/create-event.js';
import { DAY, MINUTE } from '@/constants/time.js';
import { config } from '@/env.js';
import { logToChannel } from '@/util/channel-logging.js';
import { hasAnyRole } from '@/util/member.js';

// Lock-out: only warn on members who joined within this window.
const NEW_MEMBER_WINDOW = 10 * DAY;

// Don't alert on the same member more than once inside this window.
const PER_USER_COOLDOWN = 10 * MINUTE;

// --- Regex builder fragments (same composition pattern as the old just-ask feature) ---

// Who / how a request is opened.
const reOpener = `(?:can|could|would|will|pls|please|any(?:one|body)|some(?:one|body))`;

// Verbs used to solicit engagement with self-promoted content.
const rePromoVerb = `(?:check(?: (?:it|this|them))? ?out|take a look|look at|have a look|visit|see|view|rate|review|join|sub(?:scribe)?(?: to)?|follow|support|buy|order|download|install)`;

// Things a solicitor typically promotes.
const rePromoNoun = `(?:web ?site|site|portfolio|project|app|application|store|shop|product|service|server|discord|channel|page|profile|start[- ]?up|brand|content|video|stream|business|gig|course|bot|token|nft|coin)`;

// Roles a recruiter fishes for.
const reRole = `(?:developers?|devs?|designers?|coders?|programmers?|engineers?|freelancers?|editors?|writers?|marketers?|artists?|mods?|managers?|assistants?|testers?)`;

// Ways of asking someone to move to DMs / private contact.
const reContactVerb = `(?:dm|pm|msg|message|contact|hmu|hit me up|inbox|reach out to|text|ping|whatsapp|telegram)`;

type SolicitationRule = { label: string; pattern: RegExp };

// Each rule is assembled from the fragments above, mirroring the just-ask builder style.
const rules: SolicitationRule[] = [
  {
    // "can anyone check out my website?", "please look at my new portfolio"
    label: 'Self-promotion',
    pattern: new RegExp(
      String.raw`\b${reOpener}\b[\s\S]{0,40}?${rePromoVerb}[\s\S]{0,20}?\b(?:my|our)\s+(?:\w+\s+){0,2}?${rePromoNoun}`,
      'i'
    ),
  },
  {
    // "check out my website", "sub to my channel" (opener optional)
    label: 'Self-promotion',
    pattern: new RegExp(
      String.raw`\b${rePromoVerb}\s+(?:\w+\s+){0,3}?\b(?:my|our)\s+(?:\w+\s+){0,2}?${rePromoNoun}`,
      'i'
    ),
  },
  {
    // "who is looking for a developer", "anyone need a designer / hiring devs"
    label: 'Recruiting',
    pattern: new RegExp(
      String.raw`\b(?:who(?:'?s| is)?|any(?:one|body))\s+(?:is\s+)?(?:looking for|need(?:s|ing)?|want(?:s|ing)?|hiring|in need of|searching for)\s+(?:an?\s+)?(?:good\s+|skilled\s+|experienced\s+)?${reRole}`,
      'i'
    ),
  },
  {
    // "looking for a developer / clients / work / projects"
    label: 'Recruiting',
    pattern: new RegExp(
      String.raw`\blooking for\s+(?:an?\s+)?(?:${reRole}|work|clients?|projects?|gigs?|jobs?|customers?)`,
      'i'
    ),
  },
  {
    // "i can help you, dm me", "i build websites — message me"
    label: 'Service offer + DM',
    pattern: new RegExp(
      String.raw`\bi\s*(?:'?m|am|can|will|'ll|do|offer)\b[\s\S]{0,60}?\b${reContactVerb}\s+me\b`,
      'i'
    ),
  },
  {
    // "dm me for ...", "hmu", "message me if interested"
    label: 'DM solicitation',
    pattern: new RegExp(String.raw`\b${reContactVerb}\s+me\b`, 'i'),
  },
];

/**
 * Returns the label of the first solicitation rule the text matches, or null.
 * Exported for unit testing.
 */
export const detectSolicitation = (text: string): string | null => {
  for (const { label, pattern } of rules) {
    if (pattern.test(text)) {
      return label;
    }
  }
  return null;
};

const isBrandNewMember = (member: GuildMember): boolean => {
  if (!member.joinedTimestamp) {
    return false;
  }
  return Date.now() - member.joinedTimestamp <= NEW_MEMBER_WINDOW;
};

// Tracks the last time we alerted about a given member, to avoid flooding mods.
const lastAlertByUser = new Map<string, number>();

const isOnCooldown = (userId: string): boolean => {
  const last = lastAlertByUser.get(userId);
  return last !== undefined && Date.now() - last < PER_USER_COOLDOWN;
};

const shouldCheck = (message: Message): message is Message<true> => {
  if (message.author.bot || message.author.system || !message.inGuild()) {
    return false;
  }
  const member = message.member;
  if (member === null) {
    return false;
  }
  if (
    hasAnyRole(member, ...config.roleIds.moderators) ||
    member.permissions.has(PermissionFlagsBits.ModerateMembers)
  ) {
    return false;
  }
  return isBrandNewMember(member) && !isOnCooldown(member.id);
};

const buildAlert = (message: Message<true>, category: string): EmbedBuilder => {
  const { author, member } = message;
  const joined = member?.joinedTimestamp
    ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`
    : 'unknown';

  return new EmbedBuilder()
    .setAuthor({
      name: `${author.tag} (${author.id})`,
      iconURL: author.displayAvatarURL(),
    })
    .setTitle('🚨 Possible solicitation from a new member')
    .setDescription(message.content.slice(0, 1000) || '*no text content*')
    .addFields(
      { name: 'Member', value: `<@${author.id}>`, inline: true },
      { name: 'Category', value: category, inline: true },
      { name: 'Channel', value: `<#${message.channelId}>`, inline: true },
      {
        name: 'Account created',
        value: `<t:${Math.floor(author.createdTimestamp / 1000)}:R>`,
        inline: true,
      },
      { name: 'Joined server', value: joined, inline: true },
      { name: 'Jump', value: `[Go to message](${message.url})`, inline: true }
    )
    .setColor('Yellow')
    .setFooter({ text: 'No action taken, to be reviewed manually.' })
    .setTimestamp();
};

export const solicitationWatchEvent = createEvent(
  {
    name: Events.MessageCreate,
  },
  async (message) => {
    if (!shouldCheck(message)) {
      return;
    }

    const category = detectSolicitation(message.content);
    if (category === null) {
      return;
    }

    lastAlertByUser.set(message.author.id, Date.now());

    const channel = message.client.channels.cache.get(
      config.channelIds.repelLogs
    ) as TextChannel | undefined;

    const mention = config.roleIds.moderators
      .map((id) => `<@&${id}>`)
      .join(' ');

    await logToChannel({
      channel: channel ?? null,
      fallbackChannelId: config.channelIds.repelLogs,
      content: {
        type: 'embed',
        embed: buildAlert(message, category),
        content: mention || undefined,
      },
    });
  }
);
