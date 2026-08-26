"use client"

import { useState } from "react"
import { Check, Pencil, Plus, ShoppingBag, Trash2, X } from "lucide-react"
import {
  Badge,
  Button,
  Input,
  Text,
  View,
} from "@amazecontinuityprojects/amazeui"
import { useCart } from "@/components/cart-context"

export function CartManagerBar() {
  const {
    carts,
    activeCartId,
    activeCartName,
    createCart,
    switchCart,
    renameCart,
    deleteCart,
  } = useCart()
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState("")

  const startRename = (id: string, current: string) => {
    setRenamingId(id)
    setRenameValue(current)
  }

  const commitRename = () => {
    if (renamingId && renameValue.trim()) {
      renameCart(renamingId, renameValue)
    }
    setRenamingId(null)
  }

  const cartCount = (id: string) =>
    carts
      .find((c) => c.id === id)
      ?.items.reduce((sum, entry) => sum + entry.qty, 0) ?? 0

  return (
    <View className="rounded-2xl border border-border bg-card/60 p-4 shadow-xs">
      <div className="mb-3 flex items-center justify-between gap-2">
        <Text className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <ShoppingBag className="size-3.5" aria-hidden="true" />
          Your Carts ({carts.length})
        </Text>
        <Button
          variant="outline"
          size="sm"
          className="gap-1"
          onClick={() => createCart()}
          aria-label="Create a new cart"
        >
          <Plus className="size-3.5" aria-hidden="true" />
          New Cart
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {carts.map((cart) => {
          const isActive = cart.id === activeCartId
          const isRenaming = renamingId === cart.id
          return (
            <View
              key={cart.id}
              className={`group flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-1.5 transition-all ${
                isActive
                  ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                  : "border-border bg-background hover:bg-muted/50"
              }`}
            >
              {isRenaming ? (
                <span className="flex items-center gap-1">
                  <Input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRename()
                      if (e.key === "Escape") setRenamingId(null)
                    }}
                    className="h-6 w-36 text-xs"
                    aria-label="Cart name"
                  />
                  <button
                    type="button"
                    onClick={commitRename}
                    aria-label="Save cart name"
                    className="flex size-5 cursor-pointer items-center justify-center rounded-full text-emerald-500 hover:bg-muted"
                  >
                    <Check className="size-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setRenamingId(null)}
                    aria-label="Cancel rename"
                    className="flex size-5 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => switchCart(cart.id)}
                    aria-pressed={isActive}
                    className={`flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors ${
                      isActive ? "text-primary" : "text-foreground hover:text-primary"
                    }`}
                  >
                    <span className="max-w-[160px] truncate">{cart.name}</span>
                    <Badge variant={isActive ? "success" : "default"} size="sm">
                      {cartCount(cart.id)}
                    </Badge>
                  </button>
                  <button
                    type="button"
                    onClick={() => startRename(cart.id, cart.name)}
                    aria-label={`Rename ${cart.name}`}
                    title="Rename"
                    className="hidden size-5 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground group-hover:flex"
                  >
                    <Pencil className="size-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteCart(cart.id)}
                    aria-label={`Delete ${cart.name}`}
                    title="Delete cart"
                    className="hidden size-5 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive group-hover:flex"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </>
              )}
            </View>
          )
        })}
      </div>

      {activeCartName && (
        <Text className="mt-2.5 text-[11px] text-muted-foreground">
          Editing &ldquo;{activeCartName}&rdquo; &mdash; all changes below apply to this cart and are saved automatically.
        </Text>
      )}
    </View>
  )
}
