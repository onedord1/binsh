interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  className?: string
}

const sizes = {
  sm: 'text-lg',
  md: 'text-2xl',
  lg: 'text-4xl',
  xl: 'text-6xl',
  '2xl': 'text-7xl',
}

export default function Logo({ size = 'md', className = '' }: LogoProps) {
  return (
    <div className={`font-logo font-bold flex items-baseline ${sizes[size]} ${className}`}>
      <span className="text-primary-500">#</span>
      <span className="text-gray-900 dark:text-white ml-[0.02em]">binsh</span>
    </div>
  )
}
