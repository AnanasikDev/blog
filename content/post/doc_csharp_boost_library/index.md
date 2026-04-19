---
title: C# Boost
description: My first project in C#
slug: csharp_boost
date: 2020-11-04
toc: always
categories:
    - Programming
    - English
tags:
    - C#
    - Documentation
    - Project
    - English
---

## Disclaimer

*My first ever project in C# with (some) documentation and (some) SOLID. The code is funny, my English is relaxed, my confidence high; still, it was precious. It was back in 2020 when I was switching from Python to C# with some assistance, which really helped me push through the initial phase rather quickly. [2026-04-09]*

---

[Github repo](https://github.com/AnanasikDev/BoostLibrary)

## Documentation

If You are c# coder and wanna work more effective - you may use my library. 

I do and I will upgrade it, so you can use the latest version with fixed bugs/added new features. 

Contributing is the good help and motivation for me to make your code more simpless and readable.

### What can this lib do?

This lib can simplifie working with collections like list I called Liars & random numbers, collections generators, etc.. More details below.

### Examples

#### Class Liar

Collection, that works really like list, but has more functionality

Insert & remove collections/items, sort, pop, replace and a lot of other funcs.

#### Class Range

Collection generator

Generates number-filled Liar with some settings. Useful thing)

#### Class Randomer

Random nums generator

Generates few (or probably one) random numbers. It also can choose item, mix collection and other things, that you missed in default Random)

#### Class Number

Holds value, that can be anyone number type. It contains int, float, decimal and so on types.

Really useful. It is used in almost whole of library functions.

#### Static Class Num

Adding some new functions for Number. For example - numsAfterPoint, numsBeforePoint, Pow, Root and other.

#### Static Class Round

Adding new rounding functions.

#### Class Set

Holds liar, that has only unique items. Has some functions from liar.

<details><summary><strong>Range in details</strong></summary><p>

The most simple example:

```cs
Liar<Number> myRange = new Range(0, 10);
Console.WriteLine(myRange);
```
or
```cs
Range myRange = new Range(0, 10);
Console.WriteLine(myRange);
```
The different is Liar has functions, that does not have Range. If you have Range obj you can get next/prev item etc.; working with liar 
gives some other features. So, it is your choose, what whould you use in here.
    
Example with end < start and step < 0. 

```cs
Liar<Number> myRange = new Range(15, -5, -2, true, false); 
//It whould create reversed Range
Console.WriteLine(myRange);
```

You also may use your func to change value on the each range iteration:

```cs
Number CurrentValue = 1;  
//This var we are changing at the each range iteration

Range RangeObject = new Range(new ToRound(true, 1), 0, 10, 1, 
false, false, valueStruct: new FuncANDArgs(SomeFunc));    
//Here we are creating one Range object
print(RangeObject);

//FuncANDArgs is a struct in Utils that contains func, args(if you need) 
//and bool var Firstly(if true then func workes before changing value; else after)

dynamic SomeFunc(dynamic args)
{
    CurrentValue *= 2;
    return CurrentValue;
}
```
Result:

    2 4 8 16 32 64 128 256 512

But here range starts from 2 - this is because of Firstly (writed before) is true (default value)

If we whould change Firstly to false this whould be fixed:

    1 2 4 8 16 32 64 128 256

If you didn`t understand:

```cs
valueStruct : new FuncANDArgs(SomeFunc, false)) <- right line :D
```

You also may create function returns random number for valueStruct:

```cs
int SomeFunc(object[] args)
{
    Randomer r = new Randomer();
    return r.Rand(1, 10); //start, end, step=1
}
```
Using this func make your Range object filled by random nums

There are some usefull operators:

++; Appends next item

--; Removes last item

+, * Appending collection/item, mults range n times

and so on

Arguments type is Number

PS: I`m sorry, that name of Range class is familiar to System.Range
</p></details>

<details><summary><strong>Randomer in depth</strong></summary><p>
<details><summary><strong>Let`s start!</strong></summary><p>

For the start you should create one Randomer`s object:
```cs
Randomer r = new Randomer();
```

You can put start & end values as args when you create object:
```cs
Randomer r = new Randomer(0, 10, 3); // -> third argument is step. Now you will get random nums that multiplies 3.
```
Yeah, there is a fourth arg, that means count. Count default value = 1, so you`ll get one rnd number.
```cs
Randomer r = new Randomer(0, 10, 3, 4); // -> now you`ll get four rnd numbers.
```

All methods, those names have prefix "Fast" are static.
</p></details>
<details><summary><strong>Rand()</strong></summary><p>
Next step - is creating nums, because we haven`t do it yet.

```cs
Liar<Number> number = r.Rand(0.001m, 10.5, 4.01f, 7); //Creating some numbers
```
As you can see, this function can generate random numbers use input arguments 

of all number-types (int, decimal, float, short, etc.)

If you need to create nums in loop, you may write your new params in Rand func 
instead of change r`s fields in each iteration, you should:
```cs
for (int _ = 0; _ < 3; _++)
{
    //Some code..
    Number number = r.RandOne(0, 10, 2, 4);
    //Some code..
}
```
</p></details>
<details><summary><strong>CollectionRandMix()</strong></summary><p>

If you need to mix you collection - use this func!

```cs
Randomer r = new Randomer();
Liar<Number> something = new Range(0, 6, 1);
something = r.RandMix(something);
Console.WriteLine(something);
```
Here you`ll get you Liar mixed. It is so usefull))

</p></details>
<details><summary><strong>CollectionRandChoose()</strong></summary><p>

Use this to get random item from your collection.

```cs
Randomer r = new Randomer();
Liar<Number> something = new Range(0, 6, 1);
int count = 4;
Liar<Number> items = r.RandChoose(something, count);
Console.WriteLine(items);
```
Here you are!
</p></details>
</p></details>

<details><summary><strong>Liar</strong></summary><p>
<details><summary><strong>Start!</strong></summary><p>

Firstly, we should create new object:

```cs
Liar<int> myLiar = new Liar<int>();
```
If you wanna put some items into Liar by easy way:

```cs
Liar<int> myLiar = new Liar<int>() { 1, 2, 3 }; //Just put your items here, like you do it with List
```
or create the same one by another way:
```cs
Liar<int> myLiar = new Liar<int>( 1, 2, 3 ); //Result is same as previously
```
You also can remove, append, pop, get items, sort by lots of rules, concatenate and multiply, reverse, replace items and other functions. Try it!

</p></details>

<details><summary><strong>Appending & Inserting</strong></summary><p>

The same thing to Lists.


.Append(item) - appends item to end;

.Add(item) - the same one to Append;

.AppendCollection(collection) - appends collection to end;

.Insert(item, index) - inserts item to index;

.InsertCollection(collection, index) - inserts collection to index;

.Prepend(item) - adds item to start.


```cs
Liar<Number> a = new Liar<Number>();
a.Append(2);
```
```
 >>> 2
```
```cs
Liar<Number> a = new Liar<Number>();
a.Insert(2, 3); //if collection is empty - index=0
```
```
 >>> 2
```
```cs
Liar<Number> a = new Liar<Number>() {1,2,3};
Liar<Number> b = new Liar<Number>() {6,5,3};
a.InsertCollection(b, 1);
```
```
 >>> 1 6 5 3 2 3
```
</p></details>
<details><summary><strong>Removing</strong></summary><p>

.Remove(item) - removes first item;

.RemoveAt(index) - removes liar[index];

.RemoveAt(index, count) - removes all from index count times;

.RemoveRange(start, end, step) - removes range;

.RemoveAtIndecies(indecies) - removes items at all indecies;

.RemoveCollection(collection) - removes all item that liar collection have;

.RemoveAll(item) - removes all items;

.RemoveAll() - clears;

.RemoveAll(function) - removes all items function(item) == true;

.RemoveFirst(item) - the same to regular remove;

.RemoveFirst() - removes first;

.RemoveFirst(function) - removes first item function(item) == true;

.RemoveLast(item) - removes last item;

.RemoveLast() - removes last;

.RemoveLast(function) - removes last item function(item) == true;

```cs
Liar<Number> a = new Liar<Number>() {1,2,3};
a.Remove(2);
```

```
 >>> 1, 3
```

```cs
Liar<Number> a = new Liar<Number>() {1,2,3};
a.RemoveAt(0);
```
```
 >>> 2, 3
```
 ```cs
Liar<Number> a = new Range(0, 5, 1, true, true);
a.RemoveAtIndecies(0, 2);
```
```
 >>> 1, 3, 4, 5
```
</p></details>

<details><summary><strong>Replacing</strong></summary><p>

.ReplaceAll(oldValue, newValue) - replaces all items equal oldValue for newValue;

.ReplaceSome(oldValue, newValue, count) - replaces count entries of oldValue for newValue;

.ReplaceSome(oldValue, newValue, count, start) - replaces all items equal oldValue for newValue from start to start + count;

.ReplaceFirst(oldValue, newValue) - replaces first item equals oldValue for newValue;

.ReplaceLast(oldValue, newValue) - replaces last item equals oldValue for newValue;

.ReplaceInRange(oldValue, newValue, start, end) - replaces all items equal oldValue for newValue in range;

.ReplaceAllCollection(oldValues, newValues) - replaces all entries of items from oldValues for newValues;

.ReplaceSomeCollection(oldValues, newValues, count) - replaces count entries of items from oldValues for newValues;

.ReplaceSomeCollection(oldValues, newValues, start, end) - replaces all entries of all items from oldValues for newValues in range;

.ReplaceFirstCollection(oldValues, newValues) - replaces first entry of all items from oldValues for newValues;

.ReplaceLastCollection(oldValues, newValues) - replaces last entry of all items from oldValues for newValues;

```cs
Liar<Number> SomeCol = new Liar<Number>() { 0, 1, 6, 2, 7};
SomeCol = SomeCol.ReplaceFirst(2, 9);
```
```
 >>> 0, 1, 6, 9, 7
```
```cs
Liar<Number> SomeCol = new Liar<Number>() { 2, 1, 6, 2, 7, 2, 4, 2};
SomeCol = SomeCol.ReplaceAll(2, 9);
```
```
 >>> 9 1 6 9 7 9 4 9
 ```
</p></details>
<details><summary><strong>Sorting functions!</strong></summary><p>

Library has the one and very-very effective algorithm - is called *"Fast sorting"*
Yeah, it`s pretty obvious that this function is fast))
This functionality is owned by class Sorter.
```cs
Liar<Number> myLiar = new Range(0, 10, -2);
print(myLiar);
print(Sorter.QuickSort(myLiar));
```
Result:
    
    8 6 4 2 0
    0 2 4 6 8

First line - is raw liar; Second - sorted

String sorting!
```cs
Liar<string> l = new Liar<string>() {"Awake", "Honey", "Oak", "Bike", "Wizard", "USA"};
Console.WriteLine(Sorter.QuickSort(l, SortingMode.STRINGcharGREATER));
```

SortingMode modes:

*GREATER,   greater nums

*LESS,      less nums

*EQALS,     nothing changes

*RANDOM,    random mixing


*STRINGlenGREATER,      greater length

*STRINGlenLESS,         less length

*STRINGcharGREATER,     greater char in string num

*STRINGcharLESS,        less char int string num


*CHARGREATER,   greater char num by right

*CHARLESS       less char num by right
</p></details>
</p></details>

project started at 24.08.2020