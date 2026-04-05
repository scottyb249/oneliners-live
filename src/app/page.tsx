import JoinForm from '@/app/components/JoinForm'

export default function Home() {
  return (
    <main className="flex min-h-full flex-col items-center justify-center bg-zinc-950 px-4 py-16">
      {/* Logo / Header */}
      <div className="mb-10 text-center">
        <p className="mb-2 text-sm font-semibold uppercase tracking-[0.4em] text-yellow-400">
          Welcome to
        </p>
        <h1 className="text-5xl font-black tracking-tight text-white sm:text-6xl">
          O.N.E. Liners
        </h1>
        <p className="mt-1 text-3xl font-bold text-yellow-400 sm:text-4xl">Live</p>
        <p className="mt-4 text-base text-white/40">
          One prompt. One line. One winner.
        </p>
      </div>

      <JoinForm />
    </main>
  )
}
