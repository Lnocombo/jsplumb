/*
 * This file contains code used when jsPlumb is being rendered in a DOM.
 *
 * Copyright (c) 2010 - 2019 jsPlumb (hello@jsplumbtoolkit.com)
 *
 * https://jsplumbtoolkit.com
 * https://github.com/jsplumb/jsplumb
 *
 * Dual licensed under the MIT and GPL2 licenses.
 */
;
(function () {

    "use strict";

    var _time = { };
    var _counts = { };
    var _timers = {};
    var _onlyProfile = null;
    var _enabled = false;

    window.jtimeEnable = function() {
        _enabled = true;
    };

    window.jtime = function(topic) {
        if (_enabled && (_onlyProfile == null || _onlyProfile === topic)) {
            _time[topic] = _time[topic] || 0;
            _timers[topic] = new Date().getTime();
            _counts[topic] = _counts[topic] || 0;
            _counts[topic]++;
        }
    };

    window.jtimeEnd = function(topic) {
        if (_enabled && (_onlyProfile == null || _onlyProfile === topic)) {
            var d = new Date().getTime();
            _time[topic] = _time[topic] + (d - _timers[topic]);
        }
    };

    window.dumpTime = function() {

        function pc(a, b) {
            return Math.trunc( a / b * 100) + "%";
        }

        if (_enabled) {
            var list = [], grandTotal = 0;
            for (var t in _time) {
                list.push({topic:t, count:_counts[t], total:_time[t], avg:_time[t] /  _counts[t]});
                grandTotal += _time[t];
            }
            list.sort(function(a, b) {
                if (a.total > b.total) {
                    return -1;
                }
                else {
                    return 1;
                }

            });

            list.forEach(function(entry) {
                console.log(entry.topic + " : count [" + entry.count + "] avg [" + entry.avg + "] total [" + entry.total + "]  + percent [" + pc(entry.total, grandTotal) + "]");
            });
        }
    };

    window.jtimeProfileOnly = function(category) {
        _onlyProfile = category;
    };

    var root = this, _jp = root.jsPlumb, _ju = root.jsPlumbUtil,
        _jk = root.Katavorio, _jg = root.Biltong;

    var _getEventManager = function(instance) {
        var e = instance._mottle;
        if (!e) {
            e = instance._mottle = new root.Mottle();
        }
        return e;
    };

    var _getDragManager = function (instance, category) {

        category = category || "main";
        var key = "_katavorio_" + category;
        var k = instance[key],
            e = instance.getEventManager();

        if (!k) {

            if (category !== "main") {

                k = new _jk({
                    bind: e.on,
                    unbind: e.off,
                    getSize: _jp.getSize,
                    getConstrainingRectangle: function (el) {
                        return [el.parentNode.scrollWidth, el.parentNode.scrollHeight];
                    },
                    getPosition: function (el, relativeToRoot) {
                        // if this is a nested draggable then compute the offset against its own offsetParent, otherwise
                        // compute against the Container's origin. see also the getUIPosition method below.
                        var o = instance.getOffset(el, relativeToRoot, el._katavorioDrag ? el.offsetParent : null);
                        return [o.left, o.top];
                    },
                    setPosition: function (el, xy) {
                        el.style.left = xy[0] + "px";
                        el.style.top = xy[1] + "px";
                    },
                    addClass: _jp.addClass,
                    removeClass: _jp.removeClass,
                    intersects: _jg.intersects,
                    indexOf: function (l, i) {
                        return l.indexOf(i);
                    },
                    scope: instance.getDefaultScope(),
                    css: {
                        noSelect: instance.dragSelectClass,
                        droppable: "jtk-droppable",
                        delegatedDraggable:"jtk-delegated-draggable",
                        draggable: "jtk-draggable",
                        drag: "jtk-drag",
                        selected: "jtk-drag-selected",
                        active: "jtk-drag-active",
                        hover: "jtk-drag-hover",
                        ghostProxy: "jtk-ghost-proxy"
                    }
                });
            }

            k.setZoom(instance.getZoom());
            instance[key] = k;
            instance.bind("zoom", k.setZoom);
        }
        return k;
    };

    function hasManagedParent(container, el) {
        var pn = el.parentNode;
        while (pn != null && pn !== container) {
            if (pn.getAttribute("jtk-managed") != null) {
                return true;
            } else {
                pn = pn.parentNode;
            }
        }
    }


    var _dragOffset = null;
    var _dragStart = function(instance, params) {
        var el = params.drag.getDragElement();

        if(hasManagedParent(instance.getContainer(), el) && el.offsetParent._jsPlumbGroup == null) {
            return false;
        } else {
            //var options = el._jsPlumbDragOptions;
            //_dragChildren = el.querySelectorAll("[jtk-managed]");

            // TODO refactor, now there are no drag options on each element as we dont call 'draggable' for each one. the canDrag method would
            // have been supplied to the instance's dragOptions.

            var options = el._jsPlumbDragOptions || {};
            if (el._jsPlumbGroup) {
                _dragOffset = instance.getOffset(el.offsetParent);
            }

            var cont = true;
            if (options.canDrag) {
                cont = options.canDrag();
            }
            if (cont) {
                instance.setHoverSuspended(true);
                instance.select({source: el}).addClass(instance.elementDraggingClass + " " + instance.sourceElementDraggingClass, true);
                instance.select({target: el}).addClass(instance.elementDraggingClass + " " + instance.targetElementDraggingClass, true);
                instance.setConnectionBeingDragged(true);
            }
            return cont;
        }

    };

    var _dragMove = function(instance, params) {

        var el = params.drag.getDragElement();
        var finalPos = params.finalPos || params.pos;
        var ui = { left:finalPos[0], top:finalPos[1] };

        //var ui = null;//instance.getUIPosition([params], instance.getZoom());
        if (ui != null) {
            //var o = el._jsPlumbDragOptions;

            // TODO refactor, now there are no drag options on each element as we dont call 'draggable' for each one. the canDrag method would
            // have been supplied to the instance's dragOptions.
            var o = el._jsPlumbDragOptions || {};

            if (_dragOffset != null) {
                ui.left += _dragOffset.left;
                ui.top += _dragOffset.top;
            }

            instance.draw(el, ui, null, true);
            if (o._dragging) {
                instance.addClass(el, "jtk-dragged");
            }
            o._dragging = true;

            // for (var i = 0; i < _dragChildren.length; i++) {
            //     instance.draw(_dragChildren[i]);
            // }
        }
    };

    var _dragStop = function(instance, params) {

        var elements = params.selection, uip;

        var _one = function (_e) {
            var dragElement = _e[2].getDragElement();
            if (_e[1] != null) {
                // run the reported offset through the code that takes parent containers
                // into account, to adjust if necessary (issue 554)
                uip = this.getUIPosition([{
                    el:dragElement,
                    pos:[_e[1].left, _e[1].top]
                }]);
                if (_dragOffset) {
                    uip.left += _dragOffset.left;
                    uip.top += _dragOffset.top;
                }
                this.draw(dragElement, uip);
            }

            // TODO refactor, see above: these drag options dont exist now
            //delete _e[0]._jsPlumbDragOptions._dragging;

            this.removeClass(_e[0], "jtk-dragged");
            this.select({source: dragElement}).removeClass(this.elementDraggingClass + " " + this.sourceElementDraggingClass, true);
            this.select({target: dragElement}).removeClass(this.elementDraggingClass + " " + this.targetElementDraggingClass, true);
            this.getDragManager().dragEnded(dragElement);
        }.bind(instance);

        for (var i = 0; i < elements.length; i++) {
            _one(elements[i]);
        }

        instance.setHoverSuspended(false);
        instance.setConnectionBeingDragged(false);
        _dragOffset = null;
    };

    var _animProps = function (o, p) {
        var _one = function (pName) {
            if (p[pName] != null) {
                if (_ju.isString(p[pName])) {
                    var m = p[pName].match(/-=/) ? -1 : 1,
                        v = p[pName].substring(2);
                    return o[pName] + (m * v);
                }
                else {
                    return p[pName];
                }
            }
            else {
                return o[pName];
            }
        };
        return [ _one("left"), _one("top") ];
    };

    var _genLoc = function (prefix, e) {
            if (e == null) {
                return [ 0, 0 ];
            }
            var ts = _touches(e), t = _getTouch(ts, 0);
            return [t[prefix + "X"], t[prefix + "Y"]];
        },
        _pageLocation = _genLoc.bind(this, "page"),
        _screenLocation = _genLoc.bind(this, "screen"),
        _clientLocation = _genLoc.bind(this, "client"),
        _getTouch = function (touches, idx) {
            return touches.item ? touches.item(idx) : touches[idx];
        },
        _touches = function (e) {
            return e.touches && e.touches.length > 0 ? e.touches :
                e.changedTouches && e.changedTouches.length > 0 ? e.changedTouches :
                    e.targetTouches && e.targetTouches.length > 0 ? e.targetTouches :
                        [ e ];
        };

    /**
     Manages dragging for some instance of jsPlumb.

     TODO instead of this being accessed directly, it should subscribe to events on the jsPlumb instance: every method
     in here is called directly by jsPlumb. But what should happen is that we have unpublished events that this listens
     to.  The only trick is getting one of these instantiated with every jsPlumb instance: it needs to have a hook somehow.
     Basically the general idea is to pull ALL the drag code out (prototype method registrations plus this) into a
     dedicated drag script), that does not necessarily need to be included.


     */
    var DragManager = function (_currentInstance) {
        var _draggables = {}, _dlist = [], _elementsWithEndpoints = {},
            // elementids mapped to the draggable to which they belong.
            _draggablesForElements = {},
            e = _currentInstance.getEventManager();

        // create a delegated drag handler
        var katavorio = new _jk({
            bind: e.on,
            unbind: e.off,
            getSize: _jp.getSize,
            getConstrainingRectangle:function(el) {
                return [ el.parentNode.scrollWidth, el.parentNode.scrollHeight ];
            },
            getPosition: function (el, relativeToRoot) {
                // if this is a nested draggable then compute the offset against its own offsetParent, otherwise
                // compute against the Container's origin. see also the getUIPosition method below.
                //var o = _currentInstance.getOffset(el, relativeToRoot, el._katavorioDrag ? el.offsetParent : null);
                //var o = _currentInstance.getOffset(el, relativeToRoot, el._jsPlumbGroup ? el.offsetParent : null);
                var o = _currentInstance.getOffset(el, relativeToRoot, el.offsetParent);
                console.log("get position ", el.id, o.left, o.top);
                return [o.left, o.top];
            },
            setPosition: function (el, xy) {
                el.style.left = xy[0] + "px";
                el.style.top = xy[1] + "px";
            },
            addClass: _jp.addClass,
            removeClass: _jp.removeClass,
            intersects: _jg.intersects,
            indexOf: function(l, i) { return l.indexOf(i); },
            scope:_currentInstance.getDefaultScope(),
            css: {
                noSelect: _currentInstance.dragSelectClass,
                delegatedDraggable:"jtk-delegated-draggable",
                droppable: "jtk-droppable",
                draggable: "jtk-draggable",
                drag: "jtk-drag",
                selected: "jtk-drag-selected",
                active: "jtk-drag-active",
                hover: "jtk-drag-hover",
                ghostProxy:"jtk-ghost-proxy"
            }
        });

        var elementDragOptions = jsPlumb.extend({selector:"[jtk-managed]"}, _currentInstance.Defaults.dragOptions || {});
        elementDragOptions.start = _ju.wrap(elementDragOptions.start, function(p) {
            return _dragStart(_currentInstance, p);
        });
        elementDragOptions.drag = _ju.wrap(elementDragOptions.drag, function(p) { return _dragMove(_currentInstance, p); });
        elementDragOptions.stop = _ju.wrap(elementDragOptions.stop, function(p) { return _dragStop(_currentInstance, p); });

        var elementDragHandler = katavorio.draggable(_currentInstance.getContainer(), elementDragOptions)[0];
        _currentInstance.bind("container:change", function(newContainer) {
            elementDragHandler.destroy();
            elementDragHandler = katavorio.draggable(newContainer, elementDragOptions);
        });

        _currentInstance["_katavorio_main"] = katavorio;


        // refresh the offsets for child elements of this element.
        this.updateOffsets = function (elId, childOffsetOverrides) {
            // if (elId != null) {
            //     childOffsetOverrides = childOffsetOverrides || {};
            //     var domEl = jsPlumb.getElement(elId),
            //         id = _currentInstance.getId(domEl),
            //         children = _delements[id],
            //         parentOffset;
            //
            //     if (children) {
            //         for (var i in children) {
            //             if (children.hasOwnProperty(i)) {
            //                 var cel = jsPlumb.getElement(i),
            //                     cOff = childOffsetOverrides[i] || _currentInstance.getOffset(cel);
            //
            //                 // do not update if we have a value already and we'd just be writing 0,0
            //                 if (cel.offsetParent == null && _delements[id][i] != null) {
            //                     continue;
            //                 }
            //
            //                 if (!parentOffset) {
            //                     parentOffset = _currentInstance.getOffset(domEl);
            //                 }
            //
            //                 _delements[id][i] = {
            //                     id: i,
            //                     offset: {
            //                         left: cOff.left - parentOffset.left,
            //                         top: cOff.top - parentOffset.top
            //                     }
            //                 };
            //                 _draggablesForElements[i] = id;
            //             }
            //         }
            //     }
            // }
        };

        this.endpointDeleted = function (endpoint) {
            if (_elementsWithEndpoints[endpoint.elementId]) {
                _elementsWithEndpoints[endpoint.elementId]--;
            }
        };

        this.getElementsForDraggable = function (el) {
            if (typeof el === "string") {
                el = _currentInstance.getElement(el);
            }
            return el.querySelectorAll("[jtk-managed]");
        };

        this.elementRemoved = function (elementId) {
            var elId = _draggablesForElements[elementId];
            if (elId) {
                delete _draggablesForElements[elementId];
            }
        };

        this.reset = function () {
            _draggables = {};
            _dlist = [];
            _elementsWithEndpoints = {};
        };

        //
        // notification drag ended. We check automatically if need to update some
        // ancestor's offsets.
        //
        this.dragEnded = function (el) {
            // if (el.offsetParent != null) {
            //     var id = _currentInstance.getId(el),
            //         ancestor = _draggablesForElements[id];
            //
            //     if (ancestor) {
            //         this.updateOffsets(ancestor);
            //     }
            // }
        };

        this.setParent = function (el, elId, p, pId, currentChildLocation) {

            _draggablesForElements[elId] = pId;
        };

        this.clearParent = function(el, elId) {
            var current = _draggablesForElements[elId];
            if (current) {
                delete _draggablesForElements[elId];
            }
        };

        this.revalidateParent = function(el, elId, childOffset) {
            var current = _draggablesForElements[elId];
            if (current) {
                var co = {};
                co[elId] = childOffset;
                this.updateOffsets(current, co);
                _currentInstance.revalidate(current);
            }
        };

    };

    var _setClassName = function (el, cn, classList) {
            cn = _ju.fastTrim(cn);
            if (typeof el.className.baseVal !== "undefined") {
                el.className.baseVal = cn;
            }
            else {
                el.className = cn;
            }

            // recent (i currently have  61.0.3163.100) version of chrome do not update classList when you set the base val
            // of an svg element's className. in the long run we'd like to move to just using classList anyway
            try {
                var cl = el.classList;
                if (cl != null) {
                    while (cl.length > 0) {
                        cl.remove(cl.item(0));
                    }
                    for (var i = 0; i < classList.length; i++) {
                        if (classList[i]) {
                            cl.add(classList[i]);
                        }
                    }
                }
            }
            catch(e) {
                // not fatal
                _ju.log("JSPLUMB: cannot set class list", e);
            }
        },
        _getClassName = function (el) {
            return (typeof el.className.baseVal === "undefined") ? el.className : el.className.baseVal;
        },
        _classManip = function (el, classesToAdd, classesToRemove) {
            classesToAdd = classesToAdd == null ? [] : _ju.isArray(classesToAdd) ? classesToAdd : classesToAdd.split(/\s+/);
            classesToRemove = classesToRemove == null ? [] : _ju.isArray(classesToRemove) ? classesToRemove : classesToRemove.split(/\s+/);

            var className = _getClassName(el),
                curClasses = className.split(/\s+/);

            var _oneSet = function (add, classes) {
                for (var i = 0; i < classes.length; i++) {
                    if (add) {
                        if (curClasses.indexOf(classes[i]) === -1) {
                            curClasses.push(classes[i]);
                        }
                    }
                    else {
                        var idx = curClasses.indexOf(classes[i]);
                        if (idx !== -1) {
                            curClasses.splice(idx, 1);
                        }
                    }
                }
            };

            _oneSet(true, classesToAdd);
            _oneSet(false, classesToRemove);

            _setClassName(el, curClasses.join(" "), curClasses);
        };

    root.jsPlumb.extend(root.jsPlumbInstance.prototype, {

        headless: false,

        pageLocation: _pageLocation,
        screenLocation: _screenLocation,
        clientLocation: _clientLocation,

        getDragManager:function() {
            if (this.dragManager == null) {
                this.dragManager = new DragManager(this);
            }

            return this.dragManager;
        },

        recalculateOffsets:function(elId) {
            this.getDragManager().updateOffsets(elId);
        },

        createElement:function(tag, style, clazz, atts) {
            return this.createElementNS(null, tag, style, clazz, atts);
        },

        createElementNS:function(ns, tag, style, clazz, atts) {
            var e = ns == null ? document.createElement(tag) : document.createElementNS(ns, tag);
            var i;
            style = style || {};
            for (i in style) {
                e.style[i] = style[i];
            }

            if (clazz) {
                e.className = clazz;
            }

            atts = atts || {};
            for (i in atts) {
                e.setAttribute(i, "" + atts[i]);
            }

            return e;
        },

        getAttribute: function (el, attName) {
            return el.getAttribute != null ? el.getAttribute(attName) : null;
        },

        setAttribute: function (el, a, v) {
            if (el.setAttribute != null) {
                el.setAttribute(a, v);
            }
        },

        setAttributes: function (el, atts) {
            for (var i in atts) {
                if (atts.hasOwnProperty(i)) {
                    el.setAttribute(i, atts[i]);
                }
            }
        },
        removeAttribute:function(el, attName) {
            el.removeAttribute && el.removeAttribute(attName);
        },
        appendToRoot: function (node) {
            document.body.appendChild(node);
        },
        getClass:_getClassName,
        addClass: function (el, clazz) {

            if (el != null && clazz != null && clazz.length > 0) {
                window.jtime("addClass");
                if (el.classList) {
                    window.DOMTokenList.prototype.add.apply(el.classList, _ju.fastTrim(clazz).split(/\s+/));

                } else {
                    _classManip(el, clazz);
                }

                window.jtimeEnd("addClass");

            }
        },
        hasClass: function (el, clazz) {
            if (el.classList) {
                return el.classList.contains(clazz);
            }
            else {
                return _getClassName(el).indexOf(clazz) !== -1;
            }
        },
        removeClass: function (el, clazz) {
            if (el != null && clazz != null && clazz.length > 0) {
                if (el.classList) {
                    window.DOMTokenList.prototype.remove.apply(el.classList, clazz.split(/\s+/));
                } else {
                    _classManip(el, null, clazz);
                }
            }
        },
        toggleClass:function(el, clazz) {
            if (el != null && clazz != null && clazz.length > 0) {
                if (el.classList) {
                    el.classList.toggle(clazz);
                }
                else {
                    if (jsPlumb.hasClass(el, clazz)) {
                        jsPlumb.removeClass(el, clazz);
                    } else {
                        jsPlumb.addClass(el, clazz);
                    }
                }
            }

        },
        setPosition: function (el, p) {
            el.style.left = p.left + "px";
            el.style.top = p.top + "px";
        },
        getPosition: function (el) {
            var _one = function (prop) {
                var v = el.style[prop];
                return v ? v.substring(0, v.length - 2) : 0;
            };
            return {
                left: _one("left"),
                top: _one("top")
            };
        },
        getStyle:function(el, prop) {
            if (typeof window.getComputedStyle !== 'undefined') {
                return getComputedStyle(el, null).getPropertyValue(prop);
            } else {
                return el.currentStyle[prop];
            }
        },
        getSelector: function (ctx, spec) {
            var sel = null;
            if (arguments.length === 1) {
                sel = ctx.nodeType != null ? ctx : document.querySelectorAll(ctx);
            }
            else {
                sel = ctx.querySelectorAll(spec);
            }

            return sel;
        },
        getOffset:function(el, relativeToRoot, container) {
            window.jtime("get offset");
            //console.log("get offset arg was " + el);
            //el = jsPlumb.getElement(el);
            container = container || this.getContainer();
            var out = {
                    left: el.offsetLeft,
                    top: el.offsetTop
                },
                op = (relativeToRoot  || (container != null && (el !== container && el.offsetParent !== container))) ?  el.offsetParent : null,
                _maybeAdjustScroll = function(offsetParent) {
                    if (offsetParent != null && offsetParent !== document.body && (offsetParent.scrollTop > 0 || offsetParent.scrollLeft > 0)) {
                        out.left -= offsetParent.scrollLeft;
                        out.top -= offsetParent.scrollTop;
                    }
                }.bind(this);

            while (op != null) {
                out.left += op.offsetLeft;
                out.top += op.offsetTop;
                _maybeAdjustScroll(op);
                op = relativeToRoot ? op.offsetParent :
                    op.offsetParent === container ? null : op.offsetParent;
            }

            // if container is scrolled and the element (or its offset parent) is not absolute or fixed, adjust accordingly.
            if (container != null && !relativeToRoot && (container.scrollTop > 0 || container.scrollLeft > 0)) {
                var pp = el.offsetParent != null ? this.getStyle(el.offsetParent, "position") : "static",
                    p = this.getStyle(el, "position");
                if (p !== "absolute" && p !== "fixed" && pp !== "absolute" && pp !== "fixed") {
                    out.left -= container.scrollLeft;
                    out.top -= container.scrollTop;
                }
            }
            window.jtimeEnd("get offset");

            return out;
            // return {
            //     left:Math.random() * 600,
            //     top:Math.random() * 600
            // };
        },
        //
        // return x+y proportion of the given element's size corresponding to the location of the given event.
        //
        getPositionOnElement: function (evt, el, zoom) {
            var box = typeof el.getBoundingClientRect !== "undefined" ? el.getBoundingClientRect() : { left: 0, top: 0, width: 0, height: 0 },
                body = document.body,
                docElem = document.documentElement,
                scrollTop = window.pageYOffset || docElem.scrollTop || body.scrollTop,
                scrollLeft = window.pageXOffset || docElem.scrollLeft || body.scrollLeft,
                clientTop = docElem.clientTop || body.clientTop || 0,
                clientLeft = docElem.clientLeft || body.clientLeft || 0,
                pst = 0,
                psl = 0,
                top = box.top + scrollTop - clientTop + (pst * zoom),
                left = box.left + scrollLeft - clientLeft + (psl * zoom),
                cl = jsPlumb.pageLocation(evt),
                w = box.width || (el.offsetWidth * zoom),
                h = box.height || (el.offsetHeight * zoom),
                x = (cl[0] - left) / w,
                y = (cl[1] - top) / h;

            return [ x, y ];
        },

        /**
         * Gets the absolute position of some element as read from the left/top properties in its style.
         * @method getAbsolutePosition
         * @param {Element} el The element to retrieve the absolute coordinates from. **Note** this is a DOM element, not a selector from the underlying library.
         * @return {Number[]} [left, top] pixel values.
         */
        getAbsolutePosition: function (el) {
            var _one = function (s) {
                var ss = el.style[s];
                if (ss) {
                    return parseFloat(ss.substring(0, ss.length - 2));
                }
            };
            return [ _one("left"), _one("top") ];
        },

        /**
         * Sets the absolute position of some element by setting the left/top properties in its style.
         * @method setAbsolutePosition
         * @param {Element} el The element to set the absolute coordinates on. **Note** this is a DOM element, not a selector from the underlying library.
         * @param {Number[]} xy x and y coordinates
         * @param {Number[]} [animateFrom] Optional previous xy to animate from.
         * @param {Object} [animateOptions] Options for the animation.
         */
        setAbsolutePosition: function (el, xy, animateFrom, animateOptions) {
            if (animateFrom) {
                this.animate(el, {
                    left: "+=" + (xy[0] - animateFrom[0]),
                    top: "+=" + (xy[1] - animateFrom[1])
                }, animateOptions);
            }
            else {
                el.style.left = xy[0] + "px";
                el.style.top = xy[1] + "px";
            }
        },
        /**
         * gets the size for the element, in an array : [ width, height ].
         */
        getSize: function (el) {

            //return [100,100];
            //window.jtime("get size");
            var s =[ el.offsetWidth, el.offsetHeight ];
            //window.jtimeEnd("get size");
            return s;
           //return [ el.offsetWidth, el.offsetHeight ];
        },
        getRenderMode : function() { return "svg"; },
        // draggable : function (el, options) {
        //     var info;
        //     el = _ju.isArray(el) || (el.length != null && !_ju.isString(el)) ? el: [ el ];
        //     Array.prototype.slice.call(el).forEach(function(_el) {
        //         info = this.info(_el);
        //         if (info.el) {
        //             this._initDraggableIfNecessary(info.el, true, options, info.id, true);
        //         }
        //     }.bind(this));
        //     return this;
        // },
        initDraggable: function (el, options, category) {
            _getDragManager(this, category).draggable(el, options);
            el._jsPlumbDragOptions = options;
        },
        destroyDraggable: function (el, category) {
            _getDragManager(this, category).destroyDraggable(el);
            delete el._jsPlumbDragOptions;
        },
        unbindDraggable: function (el, evt, fn, category) {
            _getDragManager(this, category).destroyDraggable(el, evt, fn);
        },
        setDraggable : function (element, draggable) {
            return jsPlumb.each(element, function (el) {
                //if (this.isDragSupported(el)) {
                    this._draggableStates[this.getAttribute(el, "id")] = draggable;
                    this.setElementDraggable(el, draggable);
                //}
            }.bind(this));
        },
        _draggableStates : {},
        /*
         * toggles the draggable state of the given element(s).
         * el is either an id, or an element object, or a list of ids/element objects.
         */
        toggleDraggable : function (el) {
            var state;
            jsPlumb.each(el, function (el) {
                var elId = this.getAttribute(el, "id");
                state = this._draggableStates[elId] == null ? false : this._draggableStates[elId];
                state = !state;
                this._draggableStates[elId] = state;
                this.setDraggable(el, state);
                return state;
            }.bind(this));
            return state;
        },
        // _initDraggableIfNecessary : function (element, isDraggable, dragOptions, id, fireEvent) {
        //
        //
        //     this.manage(id, element);
        //     var options = dragOptions || this.Defaults.DragOptions;
        //     options = jsPlumb.extend({}, options); // make a copy.
        //     this.initDraggable(element, options);
        //
        //     // TODO this bit i think is important, due to it figuring out nested elements.
        //     this.getDragManager().register(element);
        //
        //     /* TODO FIRST: move to DragManager. including as much of the decision to init dragging as possible.
        //     if (!jsPlumb.headless) {
        //         var _draggable = isDraggable == null ? false : isDraggable;
        //         if (_draggable) {
        //
        //                 var options = dragOptions || this.Defaults.DragOptions;
        //                 options = jsPlumb.extend({}, options); // make a copy.
        //                 if (!jsPlumb.isAlreadyDraggable(element, this)) {
        //                     var dragEvent = jsPlumb.dragEvents.drag,
        //                         stopEvent = jsPlumb.dragEvents.stop,
        //                         startEvent = jsPlumb.dragEvents.start;
        //
        //                     this.manage(id, element);
        //
        //                     options[startEvent] = _ju.wrap(options[startEvent], _dragStart.bind(this));
        //
        //                     options[dragEvent] = _ju.wrap(options[dragEvent], _dragMove.bind(this));
        //
        //                     options[stopEvent] = _ju.wrap(options[stopEvent], _dragStop.bind(this));
        //
        //                     var elId = this.getId(element); // need ID
        //
        //                     this._draggableStates[elId] = true;
        //                     var draggable = this._draggableStates[elId];
        //
        //                     options.disabled = draggable == null ? false : !draggable;
        //                     this.initDraggable(element, options);
        //                     this.getDragManager().register(element);
        //                     if (fireEvent) {
        //                         this.fire("elementDraggable", {el:element, options:options});
        //                     }
        //                 }
        //                 else {
        //                     // already draggable. attach any start, drag or stop listeners to the current Drag.
        //                     if (dragOptions.force) {
        //                         this.initDraggable(element, options);
        //                     }
        //                 }
        //
        //         }
        //     }*/
        // },
        animationSupported:true,
        getElement: function (el) {
            if (el == null) {
                return null;
            }
            // here we pluck the first entry if el was a list of entries.
            // this is not my favourite thing to do, but previous versions of
            // jsplumb supported jquery selectors, and it is possible a selector
            // will be passed in here.
            el = typeof el === "string" ? el : el.length != null && el.enctype == null ? el[0] : el;
            return typeof el === "string" ? document.getElementById(el) : el;
        },
        removeElement: function (element) {
            _getDragManager(this).elementRemoved(element);
            this.getEventManager().remove(element);
        },
        //
        // this adapter supports a rudimentary animation function. no easing is supported.  only
        // left/top properties are supported. property delta args are expected to be in the form
        //
        // +=x.xxxx
        //
        // or
        //
        // -=x.xxxx
        //
        doAnimate: function (el, properties, options) {
            options = options || {};
            var o = this.getOffset(el),
                ap = _animProps(o, properties),
                ldist = ap[0] - o.left,
                tdist = ap[1] - o.top,
                d = options.duration || 250,
                step = 15, steps = d / step,
                linc = (step / d) * ldist,
                tinc = (step / d) * tdist,
                idx = 0,
                _int = setInterval(function () {
                    _jp.setPosition(el, {
                        left: o.left + (linc * (idx + 1)),
                        top: o.top + (tinc * (idx + 1))
                    });
                    if (options.step != null) {
                        options.step(idx, Math.ceil(steps));
                    }
                    idx++;
                    if (idx >= steps) {
                        window.clearInterval(_int);
                        if (options.complete != null) {
                            options.complete();
                        }
                    }
                }, step);
        },
        // DRAG/DROP


        destroyDroppable: function (el, category) {
            _getDragManager(this, category).destroyDroppable(el);
        },
        unbindDroppable: function (el, evt, fn, category) {
            _getDragManager(this, category).destroyDroppable(el, evt, fn);
        },

        droppable :function(el, options) {
            el = _ju.isArray(el) || (el.length != null && !_ju.isString(el)) ? el: [ el ];
            var info;
            options = options || {};
            options.allowLoopback = false;
            Array.prototype.slice.call(el).forEach(function(_el) {
                info = this.info(_el);
                if (info.el) {
                    this.initDroppable(info.el, options);
                }
            }.bind(this));
            return this;
        },

        initDroppable: function (el, options, category) {
            _getDragManager(this, category).droppable(el, options);
        },
        isAlreadyDraggable: function (el) {
            return el._katavorioDrag != null;
        },
        // isDragSupported: function (el, options) {
        //     return true;
        // },
        // isDropSupported: function (el, options) {
        //     return true;
        // },
        isElementDraggable: function (el) {
            el = _jp.getElement(el);
            return el._katavorioDrag && el._katavorioDrag.isEnabled();
        },
        getDragObject: function (eventArgs) {
            return eventArgs[0].drag.getDragElement();
        },
        getDragScope: function (el) {
            return el._katavorioDrag && el._katavorioDrag.scopes.join(" ") || "";
        },
        getDropEvent: function (args) {
            return args[0].e;
        },
        getUIPosition: function (eventArgs, zoom) {
            // here the position reported to us by Katavorio is relative to the element's offsetParent. For top
            // level nodes that is fine, but if we have a nested draggable then its offsetParent is actually
            // not going to be the jsplumb container; it's going to be some child of that element. In that case
            // we want to adjust the UI position to account for the offsetParent's position relative to the Container
            // origin.
            var el = eventArgs[0].el;
            if (el.offsetParent == null) {
                return null;
            }
            var finalPos = eventArgs[0].finalPos || eventArgs[0].pos;
            var p = { left:finalPos[0], top:finalPos[1] };
            if (el._katavorioDrag && el.offsetParent !== this.getContainer()) {
                var oc = this.getOffset(el.offsetParent);
                p.left += oc.left;
                p.top += oc.top;
            }
            return p;
        },
        setDragFilter: function (el, filter, _exclude) {
            if (el._katavorioDrag) {
                el._katavorioDrag.setFilter(filter, _exclude);
            }
        },
        setElementDraggable: function (el, draggable) {
            el = _jp.getElement(el);
            if (el._katavorioDrag) {
                el._katavorioDrag.setEnabled(draggable);
            }
        },
        setDragScope: function (el, scope) {
            if (el._katavorioDrag) {
                el._katavorioDrag.k.setDragScope(el, scope);
            }
        },
        setDropScope:function(el, scope) {
            if (el._katavorioDrop && el._katavorioDrop.length > 0) {
                el._katavorioDrop[0].k.setDropScope(el, scope);
            }
        },
        addToPosse:function(el, spec) {
            var specs = Array.prototype.slice.call(arguments, 1);
            var dm = _getDragManager(this);
            _jp.each(el, function(_el) {
                _el = [ _jp.getElement(_el) ];
                _el.push.apply(_el, specs );
                dm.addToPosse.apply(dm, _el);
            });
        },
        setPosse:function(el, spec) {
            var specs = Array.prototype.slice.call(arguments, 1);
            var dm = _getDragManager(this);
            _jp.each(el, function(_el) {
                _el = [ _jp.getElement(_el) ];
                _el.push.apply(_el, specs );
                dm.setPosse.apply(dm, _el);
            });
        },
        removeFromPosse:function(el, posseId) {
            var specs = Array.prototype.slice.call(arguments, 1);
            var dm = _getDragManager(this);
            _jp.each(el, function(_el) {
                _el = [ _jp.getElement(_el) ];
                _el.push.apply(_el, specs );
                dm.removeFromPosse.apply(dm, _el);
            });
        },
        removeFromAllPosses:function(el) {
            var dm = _getDragManager(this);
            _jp.each(el, function(_el) { dm.removeFromAllPosses(_jp.getElement(_el)); });
        },
        setPosseState:function(el, posseId, state) {
            var dm = _getDragManager(this);
            _jp.each(el, function(_el) { dm.setPosseState(_jp.getElement(_el), posseId, state); });
        },
        dragEvents: {
            'start': 'start', 'stop': 'stop', 'drag': 'drag', 'step': 'step',
            'over': 'over', 'out': 'out', 'drop': 'drop', 'complete': 'complete',
            'beforeStart':'beforeStart'
        },
        animEvents: {
            'step': "step", 'complete': 'complete'
        },
        stopDrag: function (el) {
            if (el._katavorioDrag) {
                el._katavorioDrag.abort();
            }
        },
        addToDragSelection: function (spec) {
            _getDragManager(this).select(spec);
        },
        removeFromDragSelection: function (spec) {
            _getDragManager(this).deselect(spec);
        },
        clearDragSelection: function () {
            _getDragManager(this).deselectAll();
        },
        trigger: function (el, event, originalEvent, payload) {
            this.getEventManager().trigger(el, event, originalEvent, payload);
        },
        doReset:function() {
            // look for katavorio instances and reset each one if found.
            for (var key in this) {
                if (key.indexOf("_katavorio_") === 0) {
                    this[key].reset();
                }
            }
        },
        getEventManager:function() {
            return _getEventManager(this);
        },
        on : function(el, event, callback) {
            // TODO: here we would like to map the tap event if we know its
            // an internal bind to a click. we have to know its internal because only
            // then can we be sure that the UP event wont be consumed (tap is a synthesized
            // event from a mousedown followed by a mouseup).
            //event = { "click":"tap", "dblclick":"dbltap"}[event] || event;
            this.getEventManager().on.apply(this, arguments);
            return this;
        },
        off : function(el, event, callback) {
            this.getEventManager().off.apply(this, arguments);
            return this;
        }

    });

    var ready = function (f) {
        var _do = function () {
            if (/complete|loaded|interactive/.test(document.readyState) && typeof(document.body) !== "undefined" && document.body != null) {
                f();
            }
            else {
                setTimeout(_do, 9);
            }
        };

        _do();
    };
    ready(_jp.init);

}).call(typeof window !== 'undefined' ? window : this);
