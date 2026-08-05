"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { suggestAddresses, type AddressSuggestion } from "@/lib/address-autocomplete";
import { cn } from "@/lib/utils";

interface AddressAutocompleteInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onSelect: (suggestion: AddressSuggestion) => void;
  error?: string;
  placeholder?: string;
}

export function AddressAutocompleteInput({
  id,
  label,
  value,
  onChange,
  onSelect,
  error,
  placeholder = "Start typing your street address...",
}: AddressAutocompleteInputProps) {
  const suggestions = useMemo(() => suggestAddresses(value), [value]);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <label htmlFor={id} className="mb-1.5 block text-eyebrow">
        {label}
      </label>
      <input
        id={id}
        type="text"
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        onChange={(event) => {
          onChange(event.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        aria-expanded={isOpen && suggestions.length > 0}
        role="combobox"
        aria-autocomplete="list"
        aria-controls={`${id}-listbox`}
        className={cn(
          "h-11 w-full border bg-transparent px-3 text-sm outline-none placeholder:text-luxe-gray-dark/60 focus:border-luxe-black",
          error ? "border-destructive" : "border-border"
        )}
      />
      {isOpen && suggestions.length > 0 ? (
        <ul
          id={`${id}-listbox`}
          role="listbox"
          className="absolute z-20 mt-1 w-full border border-border bg-luxe-white shadow-md"
        >
          {suggestions.map((suggestion) => (
            <li key={suggestion.label} role="option" aria-selected={false}>
              <button
                type="button"
                onClick={() => {
                  onSelect(suggestion);
                  setIsOpen(false);
                }}
                className="flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm hover:bg-luxe-gray-light"
              >
                <MapPin className="mt-0.5 size-3.5 shrink-0 text-luxe-gray-dark" strokeWidth={1.5} />
                <span>{suggestion.label}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
