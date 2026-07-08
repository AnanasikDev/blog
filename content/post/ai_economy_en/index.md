---
title: Why AI cannot be too devastating
description: Economy has self balancing nature that will not allow anything overly powerful
slug: ai_economy
date: 2026-07-07
image: ai2.jpg
coverHeight: full
toc: never
categories:
    - English
tags:
    - English
    - Essay
---

If AI becomes a tool that happens to be more economically reasonable for companies and businesses to employ to deliver their products, they will hire fewer engineers with likely less qualification who will use AI all over the place to quickly deliver product. It will make company money for low effort and cost, and they will move on to their next project, and so on.

But...
wait.

It can't be that simple? AI can't just print money. Because nothing can. Or, well, it can't just make companies more money out of nothing. If AI becomes cheaper to use than engineers (or other specialists for that matter), so the entire business becomes cheaper, then it will have lower entrance threshold, more businesses will work on similar things, overflowing market. Suddenly, the money printer isn't enough to outdo market anymore. If we raise the quality/quantity bar so high up, and everyone follows it, then that bar just becomes norm, and all variations that we used to call "good" or "bad" are still there, they are just higher in absolute values, but in the exact same spot relative to the norm bar.

It means AI will become the norm in such world. If you don't use AI, you have no chance to keep up with that norm even, not to say to outperform it. However, merely using AI, like everyone, makes no difference to the market. Suddenly, you need to invent something better, to play creative. Hire passionate people who envision a better option, who can spot problems in approach and fix them.

It doesn't change how people and masses think, no matter if we are sewing dresses using needles or using fully automated pipelines. A bad dress design is bad regardless of implementation, and you won't profit much by making the exact same dresses like everyone else around you. You need to have a different, more creative, maybe weird approach. Something that people before you would call madness. They would think you are crazy. That it will never work.

That's exactly how all revolutionary inventions are made.

Again, be it by writing code manually character by character (which I still enjoy, though) or by using AI. If everyone uses AI or everyone write code manually, the bar is consistent and the difference to that bar is what we assess. We used to awe massive machines with 10 terminals that used paper as a memory storage. For the past decades we have been using high level languages to automate a lot of processes and hide complicated abstractions from us. Instead of writing machine code, we started writing assembly, C, C++ and even Python. Writing C or Python now doesn't feel like cheating, even though we can deliver an incredibly sophisticated products in days, which would be unimaginable to complete in assembly in that time.

I will miss writing code by hand. I like the intimacy with the machine. I have been writing C and C++ for a couple years, been keen on SIMD, ASM x86 and computer architecture. It all made me feel in control, like I know what I am doing and more importantly, I know what my computer is doing. I know how memory is accessed, how functions works, how loops are iterated...

or do I?

One of the greatest inventions humanity has ever made, in my opinion, is a compiler. A program that can turn human-readable, highly intuitive and simple way of expressing intention into a highly optimized machine code as if was written by genious machine code'rs.

I find it funny and at least worth pondering about. We have abstracted our machines, CPU registries, memory buses, floating point magic all into an incredibly sophisticated program that all of a sudden makes knowing how to pass a value into a registry and which registry to choose best, obsolete. Knowing assembly is at most a cool thing to brag about these days (kind of). You never think about these things. And that's a good thing, actually. Instead of thinking about which registries to deal with, how to write to them, how to perform a FMA (fused multiplication-addition) on a specific CPU, if you can use SSE or AVX or your target CPU, remembering which address means what, keeping all memory use in your head to not lose track of it...

But the truth is, users don't care about all that crap. Player would never appreciate how well memory and cache interact with each other. They will never know you used a cool nice trick to write a zero to a register by xoring itself. Noone cares.

With compilers, however, engineers can focus on whatever they are making. Suddenly, making a cool game with 3D graphics, sounds, multiple levels and a unique core mechanic became much more approachable, since you didn't have to know how every single bit is travelling in your silicon, but rather how to deliver your thoughts, your ideas to the computer, using a much more human-friendly way. That's what the programming languages are all about.

So, with simpler rules and lower entrance threshold, more people could dive into it. It didn't take a genious anymore to write a big project, you didn't need to understand what's happening on levels below nearly as much. Still, knowing it was (and is) beneficial, but not vital.

Interestingly, compilers marked a milestone, when programmers didn't know what their machines are *really* doing. Or, to put it better, *how* they are doing it[^1]. Your functions could become completely inlined and therefore stripped out, some of your code could be treated unused and carelessly removed, constants could be computed at compile time, new classes generated, loops unrolled or vectorized.

But compilers didn't feel like cheating. Everyone moved from writing assembly by hand to writing C and other high-level languages and trusting compiler to translate their intent well. Those who thought that assembly is the only way because you control everything yourself and not delegate the intimacy to a program, fell behind or adapted. With rise of C and C++ you couldn't keep up with market by writing assembly. It was just too slow and unreliable.

Ultimately, we started thinking mostly about intention and goals of our programs, not how bytes flow around in the CPU. We raised the bar by an enormous amount, introduced controversy, made some hate the new inventions. Everyone else, they adapted. They used it to write more and better programs. Kids in schools, people far away from computer science could now explore it and make something nice. Professionals could now make much more complicated, featurefull and reliable products in a fraction of time.

Compilers changed the world. They didn't make more money out of nothing. Yes, with more accessibility more bad programs started appearing, but it's just because more programs in general started appearing. The world got flood with software, be it good or bad, but now we got an unspeakable diversity of apps, games, websites, startups, ranking from quality-of-life training apps to medical and space embedded systems. The world adapted and thrived.

And the bad programs? They sunk. You don't benefit from using high-level languages more than the market does, because you can't trick it. It's more efficient to write C than assembly, so market uses C. Therefore, using C doesn't make you stand out, plus it adds more comptetition and hunt for detail and quality.

You now need **more**, not less, skill in programming to stand out and take your part of the market. Not only do you now need to know how to write code well (many people now do!), but also how to use that skill to make something useful and cool.

I find it very captivating and reassuring.

And now...

AI will surely plummet the entrance threshold, making everyone capable of developing projects professional programmers without AI would need weeks or months to complete. But they aren't stupid, they will adapt. They will see that market now uses AI, and you cannot compete without it, just because you are way too slow. So, you, like everyone else, now express an even more high-level intent and think even less about what the machine is doing with bytes. And the market broadens even further, bringing even more comptetition, requiring more skill to be able to deliver a **good** project that would make a difference.

In a nutshell, nothing will really change, apart from that the rates are going higher, and the diversity spikes. Skill is reshaping, it's moving from understanding how to operate registers in assembly, to knowing how to use APIs and programming languages, to knowing how to design applications, troubleshoot and evolve, on a larger scale. Programmers are still highly educated and experienced professionals, unsubstitutable by greedy companies. Those who lag behind, will be cut off. Like always.

That was my thoughts, hope it brought you to pondering and some relief. Thank you for reading.

[^1]: CPU pipelining, which came in different ways from 1940s to 1980s and beyond, hid instruction order. Your code could be reorganized unbeknownst to you, making you care less about what and how exactly the CPU is doing, but rather expressing the intent in the best way, trusting the CPU to do its job. See [Wikipedia](https://en.wikipedia.org/wiki/Instruction_pipelining).

### Credits

Text and cover art made by me (AnanaSeek4Jam). No AI used.