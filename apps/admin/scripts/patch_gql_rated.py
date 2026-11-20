from pathlib import Path

p = Path(__file__).resolve().parents[1] / "src" / "gql" / "graphql.ts"
t = p.read_text(encoding="utf-8")
needle = '{"kind":"Field","name":{"kind":"Name","value":"publicEventsEnabled"}}'
insert = (
    needle
    + ',{"kind":"Field","name":{"kind":"Name","value":"publicEventMatchesRated"}}'
)
out = []
i = 0
n = 0
while True:
    j = t.find(needle, i)
    if j < 0:
        out.append(t[i:])
        break
    after = t[j + len(needle) : j + len(needle) + 80]
    if "publicEventMatchesRated" in after:
        out.append(t[i : j + len(needle)])
        i = j + len(needle)
        continue
    out.append(t[i:j])
    out.append(insert)
    i = j + len(needle)
    n += 1
p.write_text("".join(out), encoding="utf-8")
print(f"patched {n} selections")
