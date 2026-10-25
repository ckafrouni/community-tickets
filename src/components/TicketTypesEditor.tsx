import { Plus, Trash2 } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '#/components/ui/input-group'
import { currencySymbol, inputToMinor, minorToInput } from '#/lib/format'
import type { TicketTypeInput } from '#/lib/schemas'

export type TicketTypeRow = { key: string; id?: number; name: string; price: string }

let nextKey = 0
const newKey = () => `row-${++nextKey}`

export function toRows(types: TicketTypeInput[], currency: string): TicketTypeRow[] {
  return types.map((type) => ({
    key: newKey(),
    id: type.id,
    name: type.name,
    price: minorToInput(type.price, currency),
  }))
}

export function fromRows(rows: TicketTypeRow[], currency: string): TicketTypeInput[] | string {
  const types: TicketTypeInput[] = []
  for (const row of rows) {
    const name = row.name.trim()
    const price = inputToMinor(row.price || '0', currency)
    if (!name) return 'Donnez un nom à chaque tarif.'
    if (price === null) return `Prix invalide pour « ${name} ». Exemple : 10 ou 12,50.`
    types.push({ id: row.id, name, price })
  }
  if (types.length === 0) return 'Ajoutez au moins un tarif.'
  return types
}

export function TicketTypesEditor({
  rows,
  currency,
  onChange,
}: {
  rows: TicketTypeRow[]
  currency: string
  onChange: (rows: TicketTypeRow[]) => void
}) {
  const update = (key: string, patch: Partial<TicketTypeRow>) =>
    onChange(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)))

  return (
    <FieldGroup className="gap-4">
      {rows.map((row, index) => (
        <div key={row.key} className="grid grid-cols-[1fr_7rem_auto] items-end gap-2">
          <Field>
            <FieldLabel htmlFor={`type-name-${row.key}`} className={index > 0 ? 'sr-only' : undefined}>
              Tarif
            </FieldLabel>
            <Input
              id={`type-name-${row.key}`}
              required
              autoCapitalize="sentences"
              placeholder="Adulte, Étudiant, Enfant…"
              value={row.name}
              onChange={(e) => update(row.key, { name: e.target.value })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`type-price-${row.key}`} className={index > 0 ? 'sr-only' : undefined}>
              Prix
            </FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <InputGroupText>{currencySymbol(currency)}</InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                id={`type-price-${row.key}`}
                inputMode="decimal"
                placeholder="0"
                aria-label={`Prix ${row.name || 'du tarif'}`}
                value={row.price}
                onChange={(e) => update(row.key, { price: e.target.value })}
              />
            </InputGroup>
          </Field>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Supprimer le tarif ${row.name}`}
            disabled={rows.length === 1}
            onClick={() => onChange(rows.filter((r) => r.key !== row.key))}
          >
            <Trash2 />
          </Button>
        </div>
      ))}
      <div>
        <Button variant="outline" onClick={() => onChange([...rows, { key: newKey(), name: '', price: '' }])}>
          <Plus data-icon="inline-start" /> Ajouter un tarif
        </Button>
        <FieldDescription className="mt-2">
          Mettez 0 pour un tarif gratuit (par exemple pour les enfants).
        </FieldDescription>
      </div>
    </FieldGroup>
  )
}
