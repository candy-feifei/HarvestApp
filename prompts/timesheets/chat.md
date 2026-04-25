```
现在要在维持现有的主题展示风格，完成其内的@prompts/timesheets.md 需求
```

```
这是前后分离的项目，前段的表现层是在frontend中，接口是放到backend中的。根据这一条修复上述修改有问题的地方，并将相关的页面按照timesheets.md创建出来。
```

```
[days.png] [days/start.png] [track_time.png]
跟着这三张图，完善timesheets中days模块的内容，主题保持不变。页面尽可能一致。功能尽可能实现。
```

```
【track_time.png】
根据submit继续完善，days的内容。另外需要让想相关中文转化为英文呢。[回到今天]和日历日期放到一起。
```

```
【calendar.png】,【retun today.png】
需要让日历可以点击并选择，return today应该按照图中的这样的格式生成。
```

```
[weeks下所有图片]
根据这些图片完善week的逻辑，不管是day还是week他们都具有一个approval状态，当时间填写完毕时，可以点击resubmit week for approval。此时进入审批流程，一旦approval就不会再允许编辑了，只有点击withdraw 可以让流程回到未approval pendding的状态。这个也有个人确认框，这个操作不应该开放给所有用户。week是需要添加add row，row也可以被删除。day也具备提交approval的流程和week一致。需要一同修改。 【生成效果不达预期】
```

```
现在add row按钮不可用，正常情况下只有该周处于approval状态时，是不可用的，add row可以点击之后在其内部的弹出框内选择项目。 【生成效果不达预期】
```

```
【add row 图片】
这是add row的界面逻辑。 【生成效果不达预期】
```

```
【month.png】
这是month的样式，帮我按照样式做一下month。
```

```
month改成calendar me改成teammates。
```

```
month改成calendar me改成teammates。
```


```
右上角day week calendar是一组，但是teammates不与他们是一组的，所以他们之间应该是有间隔的。
```

```
calendar的add time不应该是固定在底部的，每个日期的已录入的项目就应该是一条pipeline管道，他add time应该是在最下方的管道底部。他录入的时间也应该从这个管道跨度时间的end time处开始的，时间是连续的。
```