/**
 * Button 组件 —— 基于 shadcn/ui 规范
 *
 * 设计说明：
 * 采用 CVA（class-variance-authority）管理变体，与深色主题深度适配。
 * 扩展点：如需新增变体（如 ghost-danger），在 buttonVariants 中扩展即可。
 *
 * 重要：默认 type="button"，避免在 <form> 内误触发提交。
 * 需要提交表单的按钮必须显式传入 type="submit"。
 */

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  // 基础样式：inline-flex 居中、focus 可见环、禁用态
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-ams text-sm font-medium ring-offset-ams-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ams-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        // 主要操作：荧光橙
        default:
          'bg-ams-primary text-white hover:bg-ams-primary-hover',
        // 次要操作：深色卡片底
        secondary:
          'bg-ams-surface text-ams-text-primary border border-ams-border hover:bg-ams-surface-hover',
        // 危险操作：珊瑚红
        destructive:
          'bg-ams-danger text-white hover:bg-ams-danger/90',
        // 幽灵按钮：透明底
        ghost:
          'text-ams-text-secondary hover:bg-ams-surface hover:text-ams-text-primary',
        // 描边按钮
        outline:
          'border border-ams-border bg-transparent text-ams-text-primary hover:bg-ams-surface hover:text-ams-text-primary',
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
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type = 'button', ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        type={type}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
