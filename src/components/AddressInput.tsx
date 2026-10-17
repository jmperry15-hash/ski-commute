"use client";
// Address box with Google Places suggestions as you type.
// Runs in the browser with the BROWSER key (needs "Places API (New)" enabled on it).
// With no browser key it's just a normal text box.
import { useEffect, useRef, useState } from "react";
import { useMapsLibrary } from "@vis.gl/react-google-maps";

type Suggestion = { id: string; main: string; secondary: string; prediction: google.maps.places.PlacePrediction };

type Props = {
  value: string;
  onChange: (value: string) => void;
  onPick: (address: string) => void; // called when you click a suggestion
  hasBrowserKey: boolean;
};

const MIN_CHARS = 3;
const DEBOUNCE_MS = 250; // wait for a pause in typing before asking Google
// Nudge results toward Colorado (doesn't exclude other places).
const COLORADO = { north: 41.0, south: 37.0, east: -102.0, west: -109.05 };

export default function AddressInput(props: Props) {
  // useMapsLibrary must sit inside <APIProvider>, which only exists when there's a browser key.
  return props.hasBrowserKey ? <WithSuggestions {...props} /> : <PlainInput {...props} />;
}

function PlainInput({ value, onChange }: Props) {
  return (
    <input
      id="address"
      className="input"
      placeholder="Your apartment address, e.g. 1701 Wynkoop St, Denver, CO"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      autoComplete="street-address"
    />
  );
}

function WithSuggestions({ value, onChange, onPick }: Props) {
  const places = useMapsLibrary("places");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1); // highlighted row for arrow keys
  const [query, setQuery] = useState(""); // what you've actually typed (vs. text we filled in)
  const tokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const requestId = useRef(0);

  // Ask Google for suggestions shortly after you stop typing.
  useEffect(() => {
    if (!places || query.trim().length < MIN_CHARS) return;
    const id = ++requestId.current;
    const t = setTimeout(async () => {
      // A "session token" groups all the keystrokes for one address into one billable lookup.
      tokenRef.current ??= new places.AutocompleteSessionToken();
      try {
        const { suggestions } = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: query,
          sessionToken: tokenRef.current,
          includedRegionCodes: ["us"],
          locationBias: COLORADO,
        });
        if (id !== requestId.current) return; // a newer keystroke already replaced this request
        setSuggestions(
          suggestions
            .filter((s) => s.placePrediction)
            .map((s) => {
              const p = s.placePrediction!;
              return { id: p.placeId, main: p.mainText?.text ?? p.text.text, secondary: p.secondaryText?.text ?? "", prediction: p };
            }),
        );
        setActive(-1);
        setOpen(true);
      } catch (err) {
        console.error("Address suggestions failed (is Places API (New) enabled?)", err);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [places, query]);

  const pick = async (s: Suggestion) => {
    setOpen(false);
    setSuggestions([]);
    setQuery("");
    let address = s.prediction.text.text;
    try {
      // Fetching the place ends the session, so the keystrokes above aren't billed separately.
      const place = s.prediction.toPlace();
      await place.fetchFields({ fields: ["formattedAddress"] });
      address = place.formattedAddress ?? address;
    } catch (err) {
      console.error(err);
    }
    tokenRef.current = null; // next address gets a fresh session
    onChange(address);
    onPick(address);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault(); // pick the highlighted address instead of submitting the form
      pick(suggestions[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const showList = open && suggestions.length > 0 && query.trim().length >= MIN_CHARS;

  return (
    <div className="address-field">
      <input
        id="address"
        className="input"
        placeholder="Start typing your address…"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setQuery(e.target.value);
        }}
        onKeyDown={onKeyDown}
        onFocus={() => suggestions.length && setOpen(true)}
        onBlur={() => setOpen(false)}
        autoComplete="off"
        role="combobox"
        aria-expanded={showList}
        aria-controls="address-suggestions"
        aria-activedescendant={active >= 0 ? `suggestion-${active}` : undefined}
      />
      {showList && (
        <ul className="suggestions" id="address-suggestions" role="listbox">
          {suggestions.map((s, i) => (
            <li
              key={s.id}
              id={`suggestion-${i}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? "active" : ""}
              // mousedown (not click) so it fires before the input loses focus and closes the list
              onMouseDown={(e) => {
                e.preventDefault();
                pick(s);
              }}
              onMouseEnter={() => setActive(i)}
            >
              <span className="suggestion-pin">⌖</span>
              <span>
                <span className="suggestion-main">{s.main}</span>
                <span className="suggestion-secondary">{s.secondary}</span>
              </span>
            </li>
          ))}
          <li className="suggestions-footer" aria-hidden>
            powered by Google
          </li>
        </ul>
      )}
    </div>
  );
}
