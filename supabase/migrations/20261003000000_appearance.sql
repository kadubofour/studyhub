-- Personalisation: accent colour and app font (see lib/appearance.ts for the presets)
alter table public.profiles
  add column accent text not null default 'blue'
    check (accent in ('blue','violet','teal','coral','pink','amber')),
  add column font text not null default 'sans'
    check (font in ('sans','rounded','serif','readable','mono'));
