-- Run once in your Supabase project's SQL Editor.
begin;

create table public.books (
  id bigint generated always as identity primary key,
  title text not null,
  author text not null,
  category text not null,
  description text not null
);

alter table public.books enable row level security;
revoke all on public.books from anon, authenticated;
grant select on public.books to anon, authenticated;
create policy "Anyone can read books" on public.books
  for select to anon, authenticated using (true);

insert into public.books (title, author, category, description) values
  ('The Little Prince', 'Antoine de Saint-Exupéry', 'Fiction', 'A traveler from a tiny planet reminds us to look beyond appearances and notice what matters.'),
  ('Pride and Prejudice', 'Jane Austen', 'Classic', 'Sharp wit, mistaken first impressions, and an unforgettable exploration of love and social expectations.'),
  ('A Room of One''s Own', 'Virginia Woolf', 'Essays', 'A thoughtful argument for the space, independence, and opportunity that creative work needs.'),
  ('The Time Machine', 'H. G. Wells', 'Science fiction', 'A journey into the distant future raises enduring questions about progress and humanity.'),
  ('Walden', 'Henry David Thoreau', 'Nature', 'Reflections on a simpler life, close observation, and our relationship with the natural world.'),
  ('The Art of War', 'Sun Tzu', 'Philosophy', 'Brief lessons on preparation, judgment, and understanding a challenge before taking action.');

commit;
