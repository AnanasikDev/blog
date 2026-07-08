---
title: Journey to Euler's identity
description: How to come up with trigonometry, calculus, complex numbers and Euler's identity!
slug: intro_math_1_en
date: 2026-05-15
toc: always
categories:
    - Math
    - English
tags:
    - Math
    - English
math: true
---

WIP

## Step 1: Basics

\[
sin(a + b) = sin(a)cos(b) + sin(b)cos(a)
\]

\[
cos(a + b) = cos(a)cos(b) - sin(a)sin(b)
\]

\[
\lim_{x \to a}{(f(x) + g(x))} = \lim_{x \to a}{f(x)} + \lim_{x \to a}{g(x)}
\]

First remarkable (wonderful) limit:

\[
\lim_{\Delta x \to 0}\frac{sin(\Delta x)}{\Delta x} = 1
\]

\[
\lim_{\Delta x \to 0}\frac{cos(\Delta x) - 1}{\Delta x} = 0
\]

## Step 2: Derivatives for sin and cos

\[
sin'(x) = \lim_{\Delta x \to 0}\frac{sin(x + \Delta x) - sin(x)}{\Delta x} = \lim_{\Delta x \to 0}\frac{sin(x)cos(\Delta x) + sin(\Delta x)cos(x) - sin(x)}{\Delta x}
\]
\[
\lim_{\Delta x \to 0}\frac{sin(\Delta x)cos(x)}{\Delta x} + \lim_{\Delta x \to 0}\frac{sin(x)cos(\Delta x) - sin(x)}{\Delta x}
\]
\[
\lim_{\Delta x \to 0}\frac{sin(\Delta x)cos(x)}{\Delta x} + \lim_{\Delta x \to 0}\frac{sin(x)(cos(\Delta x) - 1)}{\Delta x}
\]
\[
cos(x)\lim_{\Delta x \to 0}\frac{sin(\Delta x)}{\Delta x} + sin(x)\lim_{\Delta x \to 0}\frac{cos(\Delta x) - 1}{\Delta x}
\]
\[
cos(x) \cdot 1 + sin(x) \cdot 0
\]
\[
cos(x)
\]

---

\[
cos'(x) = \lim_{\Delta x \to 0}\frac{cos(x + \Delta x) - cos(x)}{\Delta x}
\]

