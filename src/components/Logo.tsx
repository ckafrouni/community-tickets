import { cx } from './ui'

const TICKET_PATH =
  'M287 230C237 230 204 249 188 283C173 315 175 358 175 398L175 444C218 449 244 475 243 510C242 546 215 569 174 574L174 652C174 704 180 744 210 768C236 789 268 791 312 792L738 792C786 792 822 777 840 746C855 720 856 684 856 648L856 572C815 565 789 543 789 510C789 477 816 452 856 446L856 369C856 320 849 281 820 256C795 234 760 230 716 230Z M610 230C552 358 686 466 644 620C628 682 600 739 587 792L641 792C649 740 682 677 697 612C731 463 599 351 655 230Z'

/** Community Tickets mark: the ticket symbol on an ivory tile. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 1024 1024" className={cx('shrink-0', className)} role="img" aria-label="Community Tickets">
      <rect width="1024" height="1024" rx="220" fill="#f8f5ec" />
      <path fill="#2c2f31" fillRule="evenodd" d={TICKET_PATH} />
    </svg>
  )
}
