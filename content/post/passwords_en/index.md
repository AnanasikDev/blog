---
title: How strong is your password?
description: While updating my passwords, I pondered about their security and how easily they can be cracked
slug: passwords
date: 2026-02-16
categories:
    - English
tags:
    - English
    - Webapp
---

How long your new password should be so you never need to worry about getting an email one night saying that there is an unauthorized entry to your account? Not mentioning all other necessities of digital security, such as two-factor authentication, biometrics and some sane amount of suspicion towards external links and files, I will focus on passwords only.

> Important side note: some enclosed systems, such as a piece of hardware or banks will only allow a limited number of checks, be that 5 or 10, which makes the following essay pretty much meaningless, because a password of length 2 is already very unlikely to be cracked within this set of attempts.

1. So why not just make your password 1000 characters long? Or maybe even 100 to still beat any cutting-edge technology to an impossible task?

People don't have perfect memory, so it is a losing strategy to come up with a password so secure, it will keep away even yourselves. This limits our choice of passwords to something we can keep with us at all times. What can we remember best? Of course something important, and better something we use a lot, like our name, date of birth, etc. `Jeremy1978` is an awefully common pattern. Context is not always available to hackers, but they have too much statistics nowadays to assume otherwise.

To answer question #1: yes, please, make your passwords LONG AND DIVERSE. 1000 is a huge overkill, even 100 is - check the calculator below to see what I mean. Even just **12 characters** which use the full set of 92 characters (lower, capital English letters, numbers and some special characters) on the most high-end GPU of the time - `NVIDIA RTX 5090` - will take approximately **20 thousand years** to crack it. 10 characters will already drop this number down to only **3 years**, and that is because the number of possible passwords grows exponentially with length.

There is a catch here however, which seems to be quite vague. The "full" set of characters that are commonly available and recommended for use in passwords with 92 characters cannot fully be used in a password of length 12. That imposes another question to hackers - should they still check ALL those characters? As seen on the calculator below, if it is known that password uses only numbers 0-9, that 12 character long password can be cracked **400 billion times faster - in just 2 seconds!** Now instead of using JUST numbers, let's add ONE letter and ONE special symbol. Be it 12345a_67890. What now? This password cannot be cracked when only using numbers. The algorithm HAS to also include characters and special symbols, but where? They can be anywhere! Their number can also be arbitrary. Of course if the algorithm assumes only 1 letter and 1 special character in the password, it can crack it faster. This could be done either following some context information about the user, or statistics, or if the algorithm prefers to go from faster to slower options, such as first loop through all number-only passwords, raising the number of letters and/or special characters one by one. This leads to the notion that the best password of set length must be very diverse, covering the most of the "full" character set uniformly. **No bias towards one group of characters = no optimization strategy**.

Then, how to generate a password? Make it random. Use random password generators or even alternate your own password with random characters. Avoid dictionary entries however. Good cracking software will first look into existing words and try play around with them, knowing that most people would prefer a somewhat readable and memorizable password. The catch is - **You don't have to remember all your passwords! Just save them in a secure place.**

{{< password_calculator >}}

Sadly, sources do not agree on numbers in many cases, but the idea roughly matches:
- [security.org](https://www.security.org/how-secure-is-my-password/)
- [keepersecurity.com](https://www.keepersecurity.com/blog/2023/07/03/how-long-would-it-take-a-cybercriminal-to-crack-my-password/)

The interactive web app was made using Google Gemini. Statistics and numbers are picked for demonstration purposes and partially rely on publicly available statistics and tests. Article is written entirely by me.
