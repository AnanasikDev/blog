---
title: CPU ray tracing
description: Y1C Introduction into the wonderful world of ray tracing!
slug: ray_tracing_1_en
date: 2026-03-30
image: img18.png
coverHeight: full
categories:
    - Programming
    - English
    - Portfolio
tags:
    - Programming
    - English
---

My Year 1 Block C BUAS project - I scored 94/100 for it.

![](img1.png)
![](img2.png)

![](img3.png)
![](img4.png)

![](img5.png)
![](img6.png)

I put a LOT of work into denoising - scalar, SIMD and even a custom deep-learning model (see later):

![Many stochastic lights, no filtering](img8.png)
![Many stochastic lights, SIMD filtering](img7.png)

![Normal SIMD denoising, reference image](img13.png)
![DL denoising](img14.png)

Focus, blur:

![](img9.png)
![](img15.png)

Experimental soft normals for the planet:

![](img10.png)
![](img11.png)

Had some debug rendering for chunking:

![](img16.png)
![](img17.png)

as well as different layers (g-buffers):

![](img12.png)
![](img18.png)