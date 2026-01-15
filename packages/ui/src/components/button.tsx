import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../lib/utils'

const buttonVariants = cva(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
    {
        variants: {
            variant: {
                default: 'bg-[hsl(var(--primary))] text-white hover:opacity-90',
                destructive: 'bg-[hsl(var(--destructive))] text-white hover:opacity-90',
                outline:
                    'border border-[hsl(var(--border))] bg-transparent hover:bg-[hsl(var(--secondary))]',
                secondary:
                    'bg-[hsl(var(--secondary))] text-[hsl(var(--foreground))] hover:opacity-80',
                ghost: 'hover:bg-[hsl(var(--secondary))] hover:text-[hsl(var(--foreground))]',
                link: 'text-[hsl(var(--primary))] underline-offset-4 hover:underline',
            },
            size: {
                default: 'h-10 px-4 py-2',
                sm: 'h-8 px-3 text-xs',
                lg: 'h-12 px-6 text-base',
                icon: 'h-10 w-10',
            },
        },
        defaultVariants: {
            variant: 'default',
            size: 'default',
        },
    }
)

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> { }

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, ...props }, ref) => {
        return (
            <button
                className={cn(buttonVariants({ variant, size, className }))}
                ref={ref}
                {...props}
            />
        )
    }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
