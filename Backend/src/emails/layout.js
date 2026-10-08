/**
 * Master email layout.
 *
 * Rules this file obeys, because email clients are not browsers:
 *  - Tables for structure. Outlook (Word engine) ignores flex/grid entirely.
 *  - All CSS inlined on the element. Gmail strips <style> blocks on forwards.
 *  - Web fonts degrade to a real system stack; no layout depends on them loading.
 *  - Social icons are hosted PNGs (24px @2x). Outlook will not render inline SVG.
 *  - Max width 600px, single column, everything taps ≥44px on mobile.
 */
import env from '../config/env.js';

export const BRAND = {
  purple: '#4A0E67',
  purpleDark: '#3A0B50',
  purpleTint: '#F4EEF7',
  orange: '#F7941D',
  orangeDark: '#E68A1C',
  orangeTint: '#FFF5E6',
  ink: '#1A1420',
  body: '#4B4453',
  muted: '#857D8F',
  line: '#E8E3EC',
  canvas: '#F6F4F8',
  white: '#FFFFFF',
  success: '#12805C',
  danger: '#C0342B',
};

// Archivo where the client supports web fonts (Apple Mail, iOS, Samsung, some
// Outlook builds); a near-identical system grotesque everywhere else, so no
// layout depends on the font arriving. Gmail ignores web fonts entirely.
const FONT_STACK =
  "'Archivo','Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,'Helvetica Neue',Arial,sans-serif";
export const MONO_STACK = "'IBM Plex Mono','SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace";

const assets = `${env.appUrl.replace(/\/$/, '')}/email-assets`;

/**
 * The accounts the site actually links to. Icons are the official brand glyphs,
 * rendered to PNG in frontend/public/email-assets — email clients (Outlook
 * especially) cannot render inline SVG, so raster is the only option.
 *
 * NOTE: these URLs are absolute and built from APP_URL. An inbox fetches them
 * over the public internet, so APP_URL must be a reachable https host. Pointing
 * it at localhost is why images appear broken in local testing.
 */
const SOCIALS = [
  { name: 'TikTok', icon: `${assets}/social-tiktok.png`, url: 'https://www.tiktok.com/@lizexpressltd' },
  { name: 'YouTube', icon: `${assets}/social-youtube.png`, url: 'https://youtube.com/@lizexpressltd' },
  { name: 'Facebook', icon: `${assets}/social-facebook.png`, url: 'https://www.facebook.com/profile.php?id=61577030412249' },
  { name: 'Instagram', icon: `${assets}/social-instagram.png`, url: 'https://www.instagram.com/lizexpressnig' },
];

export const button = (label, url, variant = 'primary') => {
  const bg = variant === 'primary' ? BRAND.orange : BRAND.purple;
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px auto;">
    <tr>
      <td align="center" bgcolor="${bg}" style="border-radius:10px;">
        <a href="${url}"
           style="display:inline-block;padding:15px 38px;font-family:${FONT_STACK};font-size:16px;
                  font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:10px;
                  letter-spacing:-0.01em;mso-padding-alt:15px 38px;">${label}</a>
      </td>
    </tr>
  </table>`;
};

/** Large, monospaced, letter-spaced OTP block — legible and easy to transcribe. */
export const otpBlock = (code, ttlMinutes) => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:28px 0;">
    <tr>
      <td align="center" bgcolor="${BRAND.orangeTint}"
          style="border:1px solid #F6DCB4;border-radius:14px;padding:26px 16px;">
        <p style="margin:0 0 10px;font-family:${FONT_STACK};font-size:12px;font-weight:600;
                  letter-spacing:0.12em;text-transform:uppercase;color:${BRAND.muted};">
          Your verification code
        </p>
        <p style="margin:0;font-family:${MONO_STACK};
                  font-size:40px;line-height:1.1;font-weight:600;letter-spacing:0.22em;
                  color:${BRAND.purple};padding-left:0.22em;">${code}</p>
        <p style="margin:12px 0 0;font-family:${FONT_STACK};font-size:13px;color:${BRAND.muted};">
          Expires in ${ttlMinutes} minutes · one use only
        </p>
      </td>
    </tr>
  </table>`;

export const infoRow = (label, value) => `
  <tr>
    <td style="padding:11px 0;border-bottom:1px solid ${BRAND.line};font-family:${FONT_STACK};
               font-size:14px;color:${BRAND.muted};">${label}</td>
    <td align="right" style="padding:11px 0;border-bottom:1px solid ${BRAND.line};
               font-family:${FONT_STACK};font-size:14px;font-weight:600;color:${BRAND.ink};">${value}</td>
  </tr>`;

export const detailTable = (rows) => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
         style="margin:24px 0;border-top:1px solid ${BRAND.line};">
    ${rows.map(([label, value]) => infoRow(label, value)).join('')}
  </table>`;

export const notice = (text, tone = 'neutral') => {
  const palette = {
    neutral: { bg: BRAND.purpleTint, border: '#DCCFE4', color: BRAND.purple },
    warning: { bg: BRAND.orangeTint, border: '#F6DCB4', color: '#8A5200' },
    danger: { bg: '#FDF0EF', border: '#F3D0CD', color: BRAND.danger },
  }[tone];
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:22px 0;">
    <tr>
      <td bgcolor="${palette.bg}" style="border:1px solid ${palette.border};border-left:4px solid ${palette.color};
          border-radius:8px;padding:14px 16px;font-family:${FONT_STACK};font-size:14px;
          line-height:1.6;color:${palette.color};">${text}</td>
    </tr>
  </table>`;
};

const socialBar = () => `
  <table role="presentation" cellpadding="0" cellspacing="7" border="0" style="margin:0 auto 14px;">
    <tr>
      ${SOCIALS.map(
        (s) => `<td bgcolor="${BRAND.purple}" width="28" height="28"
                    style="padding:0;width:28px;height:28px;border-radius:14px;
                           mso-padding-alt:0;" class="lx-social">
          <a href="${s.url}" title="${s.name}" aria-label="${s.name}"
             style="display:block;width:28px;height:28px;text-decoration:none;">
            <img src="${s.icon}" width="28" height="28" alt=""
                 style="display:block;border:0;width:28px;height:28px;border-radius:14px;" />
          </a></td>`,
      ).join('')}
    </tr>
  </table>`;

/**
 * @param {object}  options
 * @param {string}  options.preheader Inbox preview text — the line beside the subject.
 * @param {string}  options.heading
 * @param {string}  options.body      Pre-rendered HTML for the content area.
 * @param {string} [options.eyebrow]
 * @param {string} [options.footNote]
 */
export const renderLayout = ({ preheader, eyebrow, heading, body, footNote = '' }) => `<!DOCTYPE html
  PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap" rel="stylesheet" />
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>LizExpress</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings>
    <o:PixelsPerInch>96</o:PixelsPerInch>
  </o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <style>
    @media only screen and (max-width:620px){
      .lx-wrap{width:100% !important;}
      .lx-pad{padding-left:22px !important;padding-right:22px !important;}
      .lx-h1{font-size:24px !important;}
    }
    a{color:${BRAND.purple};}
  </style>
</head>
<body style="margin:0;padding:0;background-color:${BRAND.canvas};-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${preheader}</div>
  <div style="display:none;max-height:0;overflow:hidden;">&#8199;&#65279;&#847;&nbsp;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
         style="background-color:${BRAND.canvas};">
    <tr>
      <td align="center" style="padding:34px 14px;">

        <table role="presentation" class="lx-wrap" cellpadding="0" cellspacing="0" border="0" width="600"
               style="width:600px;max-width:600px;background-color:${BRAND.white};
                      border-radius:16px;overflow:hidden;border:1px solid ${BRAND.line};">

          <!-- Masthead -->
          <tr>
            <td bgcolor="${BRAND.purple}" style="padding:28px 34px;" class="lx-pad">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td>
                    <a href="${env.appUrl}" style="text-decoration:none;">
                      <img src="${assets}/logo-white.png" width="132" height="30" alt="LizExpress"
                           style="display:block;border:0;height:30px;width:auto;
                                  font-family:${FONT_STACK};font-size:19px;font-weight:600;
                                  color:#FFFFFF;text-decoration:none;" />
                    </a>
                  </td>
                  <td align="right" style="font-family:${FONT_STACK};font-size:12px;
                             font-weight:600;color:#D9C6E4;letter-spacing:0.04em;">
                    Swap what you have<br />for what you need
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Accent rule -->
          <tr><td bgcolor="${BRAND.orange}" style="height:4px;line-height:4px;font-size:0;">&nbsp;</td></tr>

          <!-- Content -->
          <tr>
            <td class="lx-pad" style="padding:38px 40px 12px;">
              ${
                eyebrow
                  ? `<p style="margin:0 0 10px;font-family:${FONT_STACK};font-size:12px;font-weight:600;
                        letter-spacing:0.13em;text-transform:uppercase;color:${BRAND.orange};">${eyebrow}</p>`
                  : ''
              }
              <h1 class="lx-h1" style="margin:0 0 18px;font-family:${FONT_STACK};font-size:27px;
                     line-height:1.25;font-weight:600;letter-spacing:-0.02em;color:${BRAND.ink};">${heading}</h1>
              <div style="font-family:${FONT_STACK};font-size:16px;line-height:1.68;color:${BRAND.body};">
                ${body}
              </div>
            </td>
          </tr>

          ${
            footNote
              ? `<tr><td class="lx-pad" style="padding:6px 40px 34px;">
                   <p style="margin:0;font-family:${FONT_STACK};font-size:13px;line-height:1.6;
                      color:${BRAND.muted};">${footNote}</p></td></tr>`
              : '<tr><td style="height:22px;line-height:22px;font-size:0;">&nbsp;</td></tr>'
          }

          <!-- Footer -->
          <tr>
            <td bgcolor="#FAF9FB" class="lx-pad" style="padding:28px 40px;border-top:1px solid ${BRAND.line};">
              ${socialBar()}
              <p style="margin:0 0 8px;text-align:center;font-family:${FONT_STACK};font-size:13px;
                        line-height:1.6;color:${BRAND.muted};">
                <a href="${env.appUrl}/browse" style="color:${BRAND.purple};text-decoration:none;font-weight:600;">Browse items</a>
                &nbsp;·&nbsp;
                <a href="${env.appUrl}/dashboard" style="color:${BRAND.purple};text-decoration:none;font-weight:600;">Your dashboard</a>
                &nbsp;·&nbsp;
                <a href="mailto:${env.resend.replyTo}" style="color:${BRAND.purple};text-decoration:none;font-weight:600;">Support</a>
              </p>
              <p style="margin:0 0 4px;text-align:center;font-family:${FONT_STACK};font-size:12px;
                        line-height:1.6;color:${BRAND.muted};">
                LizExpress Ltd · Kano, Nigeria
              </p>
              <p style="margin:0;text-align:center;font-family:${FONT_STACK};font-size:12px;color:#A79FB0;">
                © ${new Date().getFullYear()} LizExpress Ltd. All rights reserved.
              </p>
            </td>
          </tr>
        </table>

        <p style="margin:18px auto 0;max-width:600px;text-align:center;font-family:${FONT_STACK};
                  font-size:11px;line-height:1.6;color:#A79FB0;">
          You are receiving this email because you have a LizExpress account.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;

/** Plain-text fallback. Some clients and most spam filters want one. */
export const toPlainText = (lines) => lines.filter(Boolean).join('\n\n');
