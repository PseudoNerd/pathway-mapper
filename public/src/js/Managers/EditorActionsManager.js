var GenomicDataOverlayManager = require('./GenomicDataOverlayManager.js');
var SVGExporter = require('./../Utils/SVGExporter.js');


module.exports = (function()
{
    "use strict";
    var EditorActionsManager = function(isCollaborative, realtimeManager, cyInst)
    {
        //Set cy instance and set real time manager reference if collaborative mode
        this.cy = cyInst;
        this.isCollaborative = isCollaborative;
        if(this.isCollaborative && realtimeManager)
            this.realTimeManager = realtimeManager;

        this.defaultLayoutProperties =
        {
            name: 'cose-bilkent',
            nodeRepulsion: 4500,
            nodeOverlap: 10,
            idealEdgeLength: 50,
            edgeElasticity: 0.45,
            nestingFactor: 0.1,
            gravity: 0.15,
            numIter: 2500,
            tile: true,
            animate: "end",
            randomize: false,
            gravityRangeCompound: 1.5,
            // Gravity force (constant) for compounds
            gravityCompound: 1.0,
            // Gravity range (constant)
            gravityRange: 1.5
        };
        this.FIT_CONSTANT = 50;

        this.layoutProperties = _.clone(this.defaultLayoutProperties);
        this.observers = [];
        this.genomicDataOverlayManager = new GenomicDataOverlayManager();
        this.svgExporter = new SVGExporter();

        this.selecteNodeStack = {};
        window.undoRedoManager = cy.undoRedo();
        window.undoRedoManager.action("changePositions", this.doChangePosition, this.undoChangePosition);
        window.undoRedoManager.action("changeName", this.doChangename, this.undoChangeName);
        window.undoRedoManager.action("hideNode", this.doHide, this.undoHide);
        window.undoRedoManager.action("showAllNodes", this.doShow, this.undoShow);
        // HighlightOthers is the type of highlight from the menu and by searching, while highlightInvalidGenes is for only invalid genes
        window.undoRedoManager.action("highlightInvalidGenes", this.doHighlightInvalidGenes, this.undoHighlightInvalidGenes);
        window.undoRedoManager.action("removeHighlightInvalidGenes", this.undoHighlightInvalidGenes, this.doHighlightInvalidGenes);
        window.undoRedoManager.action("highlightOthers", this.doHighlight, this.undoHighlight);
        window.undoRedoManager.action("removeOtherHighlight", this.undoHighlight, this.doHighlight);

    };

    EditorActionsManager.prototype.handleChangePositionByAlignment = function(movedNodeArr)
    {
        if (this.isCollaborative)
            this.realTimeManager.changeElementsPositionByAlignment(movedNodeArr);
        else
            window.undoRedoManager.do("changePositions", movedNodeArr)
    };

    /*
     * Undo redo for changing positions of nodes via programatically (node.position)
     * **/
    EditorActionsManager.prototype.doChangePosition = function(movedNodes)
    {
        var newMovedNodes = [];

        for(var i = 0; i < movedNodes.length; i++)
        {
            var currentNodePosition =
                {
                    x: movedNodes[i].node.position().x,
                    y: movedNodes[i].node.position().y
                };
            newMovedNodes.push({node: movedNodes[i].node, oldPosition: currentNodePosition, nextPosition: movedNodes[i].nextPosition});
            movedNodes[i].node.position(movedNodes[i].nextPosition);
        }

        return newMovedNodes;
    };

    EditorActionsManager.prototype.undoChangePosition = function(movedNodes)
    {
        var newMovedNodes = [];

        for(var i = 0; i < movedNodes.length; i++)
        {
            var currentNodePosition =
                {
                    x: movedNodes[i].node.position().x,
                    y: movedNodes[i].node.position().y
                };
            newMovedNodes.push({node: movedNodes[i].node, oldPosition: movedNodes[i].oldPosition, nextPosition: currentNodePosition});
            movedNodes[i].node.position(movedNodes[i].oldPosition);
        }

        return newMovedNodes;
    };

    EditorActionsManager.prototype.changeName = function(ele, newName)
    {
        if (this.isCollaborative)
        {
            this.realTimeManager.changeName(ele, newName);
        }
        else
        {
            this.changeNameCy(ele, newName);
        }
    };

    EditorActionsManager.prototype.changeNameCy = function(ele, newName)
    {
        var currentName = ele.data('name');
        var args = {ele: ele, oldName: currentName, newName: newName};
        window.undoRedoManager.do('changeName', args);
    };

    /*
     * Undo redo for changing name of nodes
     * **/
    EditorActionsManager.prototype.doChangename = function(args)
    {

        var currentName = args.ele.data('name');
        var newArgs = {ele: args.ele, newName: args.newName, oldName: currentName};
        args.ele.data('name', args.newName);
        args.ele.css('content', args.newName);

        return newArgs;
    };

    EditorActionsManager.prototype.undoChangeName = function(args)
    {

        var currentName = args.ele.data('name');
        var newArgs = {ele: args.ele, newName: args.oldName, oldName: currentName};
        args.ele.data('name', args.oldName);
        args.ele.css('content', args.oldName);

        return newArgs;
    };

    EditorActionsManager.prototype.hideSelectedNodes = function()
    {
        //Hides the selected elements
        var sel = cy.nodes(":selected");
        var nodesToHide = sel;
        var b = true;
        //Hides the parents if they have no children
        sel.parent().each( function(i, parent)
        {
            b=true;
            parent.children().each(function(j,ch)
                {
                    if (!ch.selected())
                    {
                        if (ch.visible()) b=false;
                    }
                }
            );
            if (b==true) nodesToHide = nodesToHide.add(parent);
        });
        nodesToHide.unselect();
        if (this.isCollaborative)
            this.realTimeManager.changeVisibility(nodesToHide, true);
        else
            window.undoRedoManager.do('hideNode', nodesToHide);
    };

    /*
     * Undo redo for hiding nodes
     * **/
    EditorActionsManager.prototype.doHide = function(args)
    {
        args.hide();
        return args;
    };

    EditorActionsManager.prototype.undoHide = function(args)
    {
        args.show();
        return args;
    };

    EditorActionsManager.prototype.showAllNodes = function()
    {
        var hid = cy.nodes(":hidden");
        if (this.isCollaborative)
            this.realTimeManager.changeVisibility(hid, false);
        else
            window.undoRedoManager.do('showAllNodes', hid);
    };

    /*
     * Undo redo for showing all nodes
     * **/
    EditorActionsManager.prototype.doShow = function(args)
    {
        args.show();
        return args;
    };

    EditorActionsManager.prototype.undoShow = function(args)
    {
        args.hide();
        return args;
    };

    EditorActionsManager.prototype.highlightInvalidGenesInitially = function(invalidHighlightedGenesIDs, invalidGenesIDs, highlightedGenesIDs)
    {
        for (var i in invalidHighlightedGenesIDs)
        {
            cy.$('#'+invalidHighlightedGenesIDs[i]).addClass('invalidGeneHighlight');
        }
        for (var i in invalidGenesIDs)
        {
            cy.$('#'+invalidGenesIDs[i]).addClass('invalidGene');
        }
        for (var i in highlightedGenesIDs)
        {
            cy.$('#'+highlightedGenesIDs[i]).addClass('highlightedNode');
        }
    };

    EditorActionsManager.prototype.validateGenes = function()
    {
        var geneSymbols = this.getGeneSymbols();
        window.portalAccessor.validateGenes(geneSymbols);
    }

    //Get all gene symbols
    EditorActionsManager.prototype.getGeneSymbols = function()
    {
        var geneSymbols = [];
        this.cy.nodes().forEach( function (gene)
        {
            if(gene.data().type === "GENE")
                geneSymbols.push(gene.data().name);
        });
        return geneSymbols;
    }


    EditorActionsManager.prototype.highlightInvalidGenes = function(validGeneSymbols)
    {
        if (this.isCollaborative)
        {
            var invalidGenes = [];
            this.cy.nodes().forEach( function (gene)
            {
                if(gene.data().type === "GENE")
                {
                    var geneName = gene.data().name;
                    if(validGeneSymbols.indexOf(geneName) < 0)
                        invalidGenes.push(gene.id());
                }
            });
            this.realTimeManager.changeHighlightInvalidGenes(invalidGenes, true);

            if (invalidGenes.length > 0)
                window.notificationManager.createNotification("Invalid genes are highlighted","fail");
            else
                window.notificationManager.createNotification("All gene symbols are valid","success");
        }
        else
        {
            var highlightedGenes = cy.collection();
            this.cy.nodes().forEach( function (gene)
            {
                if(gene.data().type === "GENE")
                {
                    var geneName = gene.data().name;
                    if(validGeneSymbols.indexOf(geneName) < 0)
                        highlightedGenes = highlightedGenes.add(gene);
                }
            });

            if (highlightedGenes.size() > 0)
                window.notificationManager.createNotification("Invalid genes are highlighted","fail");
            else
                window.notificationManager.createNotification("All gene symbols are valid","success");

            var nodesToAddInvalidHighlight = cy.collection();
            highlightedGenes.forEach(function(ele, index){
                if (!ele.hasClass('invalidGeneHighlight') &&  !ele.hasClass('invalidGene'))
                    nodesToAddInvalidHighlight = nodesToAddInvalidHighlight.union(ele);
            });
            window.undoRedoManager.do('highlightInvalidGenes', nodesToAddInvalidHighlight);
        }
    }

    EditorActionsManager.prototype.removeInvalidGeneHighlights = function(actions)
    {
        if (this.isCollaborative)
        {
            var geneIDs = [];
            this.cy.nodes().forEach( function (gene)
            {
                if(gene.data().type === "GENE")
                {
                    if(gene.hasClass('invalidGeneHighlight') || gene.hasClass('invalidGene'))
                        geneIDs.push(gene.id());
                }
            });
            this.realTimeManager.changeHighlightInvalidGenes(geneIDs, false);
        }
        else
        {
            var nodesToRemoveInvalidHighlight = cy.collection();
            cy.nodes().forEach(function(ele, index){
                if (ele.hasClass('invalidGeneHighlight') ||  ele.hasClass('invalidGene'))
                    nodesToRemoveInvalidHighlight = nodesToRemoveInvalidHighlight.union(ele);
            });
            actions.push({name: "removeHighlightInvalidGenes", param: nodesToRemoveInvalidHighlight});
            // window.undoRedoManager.do('removeHighlightInvalidGenes', nodesToRemoveInvalidHighlight);
        }
    }

    EditorActionsManager.prototype.doHighlightInvalidGenes = function(args)
    {
        args.each(function(i, n)
        {
            if(n.hasClass('highlightedNode'))
            {
                n.removeClass('highlightedNode');
                n.addClass("invalidGeneHighlight");
            }
            else
                n.addClass("invalidGene");
        });
        return args;
    };

    EditorActionsManager.prototype.undoHighlightInvalidGenes = function(args)
    {
        args.each(function(i, n)
        {
            if(n.hasClass('invalidGeneHighlight'))
            {
                n.removeClass('invalidGeneHighlight');
                n.addClass("highlightedNode");
            }
            else
                n.removeClass("invalidGene");
        });
        return args;
    }

    EditorActionsManager.prototype.highlightSelected = function()
    {
        var sel = cy.elements(":selected");
        sel.unselect();
        var elementsToHighlight = cy.collection();
        sel.forEach(function(ele, index){
            if (!ele.hasClass('invalidGeneHighlight') &&  !ele.hasClass('highlightedNode') && !ele.hasClass('highlightedEdge'))
                elementsToHighlight = elementsToHighlight.union(ele);
        });
        if (this.isCollaborative)
            this.realTimeManager.changeHighlight(elementsToHighlight, true);
        else
            window.undoRedoManager.do('highlightOthers', elementsToHighlight);
    };

    EditorActionsManager.prototype.highlightNeighbors = function()
    {
        var sel = cy.elements(":selected");
        var neighbors = sel.neighborhood();
        neighbors = neighbors.union(sel);
        neighbors.unselect();
        var elementsToHighlight = cy.collection();
        neighbors.forEach(function(ele, index){
            if (!ele.hasClass('invalidGeneHighlight') &&  !ele.hasClass('highlightedNode') && !ele.hasClass('highlightedEdge'))
                elementsToHighlight = elementsToHighlight.union(ele);
        });
        if (this.isCollaborative)
            this.realTimeManager.changeHighlight(elementsToHighlight, true);
        else
            window.undoRedoManager.do('highlightOthers', elementsToHighlight);
    };

    EditorActionsManager.prototype.highlightBySearch = function(args)
    {
        if (this.isCollaborative)
            this.realTimeManager.changeHighlight(args, true);
        else
            window.undoRedoManager.do('highlightOthers', args);
    };

    EditorActionsManager.prototype.removeOtherHighlight = function(actions)
    {
        var nodesToRemoveHighlight = cy.collection();
        //TODO cytoscape selectors may provide more handy functionality instead of iterating over !
        cy.elements().forEach(function(ele, index){
            if (ele.hasClass('highlightedNode') || ele.hasClass('highlightedEdge') || ele.hasClass('invalidGeneHighlight'))
                nodesToRemoveHighlight = nodesToRemoveHighlight.add(ele);
        });

        if (this.isCollaborative)
            this.realTimeManager.changeHighlight(nodesToRemoveHighlight, false);
        else
            actions.push({name: "removeOtherHighlight", param: nodesToRemoveHighlight});
            // window.undoRedoManager.do('removeOtherHighlight', nodesToRemoveHighlight);
    };

    /*
     * Undo redo for highlighting of nodes
     * **/
    EditorActionsManager.prototype.doHighlight = function(args)
    {
        args.each(function(i, n)
        {
            if (n.isEdge())
                n.addClass("highlightedEdge");
            else
            {
                if(n.hasClass('invalidGene'))
                {
                    n.removeClass("invalidGene");
                    n.addClass("invalidGeneHighlight");
                }
                else
                    n.addClass("highlightedNode");
            }
        });
        return args;
    };

    EditorActionsManager.prototype.undoHighlight = function(args)
    {
        args.each(function(i, n)
        {
            if (n.isEdge())
                n.removeClass("highlightedEdge");
            else
            {
                if(n.hasClass('invalidGeneHighlight'))
                {
                    n.removeClass("invalidGeneHighlight");
                    n.addClass("invalidGene");
                }
                else
                    n.removeClass("highlightedNode");
            }
        });
        return args;
    };

    EditorActionsManager.prototype.removeAllHighlight = function()
    {
        var actions = [];
        window.editorActionsManager.removeInvalidGeneHighlights(actions);
        window.editorActionsManager.removeOtherHighlight(actions);
        cy.undoRedo().do("batch", actions);
    };

    EditorActionsManager.prototype.postLayout = function()
    {
        if (this.isCollaborative)
        {
            this.moveElements(cy.nodes());
            var newState = {
                zoomLevel: cy.zoom(),
                panLevel: cy.pan()
            };
            this.updateGlobalOptions(newState);
        }
    };

    /*
    * Gets the first empty index from the list in cloud model
    * **/
    EditorActionsManager.prototype.getEmptyGroupID = function()
    {
        if(this.isCollaborative)
            return this.realTimeManager.getEmptyGroupID();
        else
            return this.genomicDataOverlayManager.getEmptyGroupID();
    };

    /*
     * Gets the first empty index from the list in cloud model
     * **/
    EditorActionsManager.prototype.groupGenomicData = function(cancerNames, groupID)
    {
        return this.realTimeManager.groupGenomicData(cancerNames, groupID);
    };

    EditorActionsManager.prototype.addPubmedIDs = function(edge, pubmedIDs)
    {
      if (this.isCollaborative)
      {
        this.realTimeManager.addPubmedIDs(edge.id(), pubmedIDs);
      }
      else
      {
        var pubmedArray = edge.data('pubmedIDs');
        var validPubmedIDs = _.filter(pubmedIDs, function(id){
          return !isNaN(id);
        });
        pubmedArray.push.apply(pubmedArray,validPubmedIDs);
        pubmedArray = edge.data('pubmedIDs');
        edge.data('pubmedIDs', _.uniq(pubmedArray));
      }
    }

    EditorActionsManager.prototype.removePubmedID = function(edge, pubmedIDs)
    {
      if (this.isCollaborative)
      {
        this.realTimeManager.removePubmedID(edge.id(), pubmedIDs);
      }
      else
      {
        var pubmedArray = edge.data('pubmedIDs');
        edge.data('pubmedIDs', _.difference(pubmedArray, pubmedIDs));
      }
    }

    //Related to order the nodes according to the selection of user
    EditorActionsManager.prototype.pushSelectedNodeStack = function(ele)
    {
        this.selecteNodeStack[ele.id()] = ele;
    }

    EditorActionsManager.prototype.removeElementFromSelectedNodeStack = function(ele)
    {
        var nodeID = ele.id();
        if (nodeID in this.selecteNodeStack)
            delete this.selecteNodeStack[ele.id()];
    }

    EditorActionsManager.prototype.clearSelectedNodeStack = function()
    {
        this.selecteNodeStack = {};
    }

    EditorActionsManager.prototype.exportSVG = function()
    {
        return this.svgExporter.exportGraph(this.cy.nodes(), this.cy.edges());
    }

    //Simple observer-observable pattern for views!!!!!
    EditorActionsManager.prototype.registerObserver = function(observer)
    {
        this.observers.push(observer);
    };

    EditorActionsManager.prototype.notifyObservers = function()
    {
        for (var i in this.observers)
        {
            var observer = this.observers[i];
            observer.notify();
        }
    };

    EditorActionsManager.prototype.registerGenomicDataObserver = function(observer)
    {
        this.genomicDataOverlayManager.registerObserver(observer);
    }

    EditorActionsManager.prototype.updateGenomicDataVisibility = function(dataMap)
    {
        if(this.isCollaborative)
        {
            //TODO compound OP
            // this.realTimeManager.clearGenomicVisData();
            this.realTimeManager.addGenomicVisibilityData(dataMap);
        }
        else
        {
            for (var _key in dataMap)
            {
                this.genomicDataOverlayManager.updateGenomicDataVisibility(_key, dataMap[_key]);
            }
            this.genomicDataOverlayManager.showGenomicData();
        }
    }

    //Global options related functions, zoom etc..
    EditorActionsManager.prototype.getGlobalOptions = function()
    {
        return {
            zoomLevel: cy.zoom(),
            panLevel: cy.pan()
        };
    }

    EditorActionsManager.prototype.changeGlobalOptions = function(globalOptions)
    {
        cy.zoom(globalOptions.zoomLevel);
        cy.pan(globalOptions.panLevel);
    }

    EditorActionsManager.prototype.updateGlobalOptions = function(newOptions)
    {
        if(this.isCollaborative)
            this.realTimeManager.updateGlobalOptions(newOptions);
    }

    //Layout properties related functions
    EditorActionsManager.prototype.saveLayoutProperties = function(newLayoutProps)
    {
        if(this.isCollaborative)
        {
            // Call a real time function that updated real time object and
            // its callback (updateLayoutPropertiesCallback) will handle sync of this object
            // across collaborators
            this.realTimeManager.updateLayoutProperties(newLayoutProps);
        }
        else
        {
            this.layoutProperties = _.clone(newLayoutProps);
        }
    };

    EditorActionsManager.prototype.updateLayoutPropertiesCallback = function(newLayoutProps)
    {
        this.layoutProperties = _.clone(newLayoutProps);
        //Notify observers to reflect changes on colalborative object to the views
        this.notifyObservers();
    };

    EditorActionsManager.prototype.performLayout = function()
    {
        window.undoRedoManager.do("layout", {options: this.layoutProperties, eles: null, zoom: cy.zoom(), pan: cy.pan()});
    };

    //Node Related Functions
    EditorActionsManager.prototype.addNode = function(nodeData, posData)
    {
        if (this.isCollaborative)
        {
            this.addNewNodeToRealTime(nodeData, posData);
        }
        else
        {
            this.addNodetoCy(nodeData,posData);
        }
    };

    EditorActionsManager.prototype.addNodes = function(nodes)
    {
        for (var i in nodes)
        {
            this.addNode(nodes[i].data, nodes[i].position);
        }
    };

    EditorActionsManager.prototype.addNodesCy = function(nodes)
    {
        var nodeArr = [];
        for (var i in nodes)
        {
            var nodeData = nodes[i].data;
            var posData = nodes[i].position;

            var newNode =
            {
                group: "nodes",
                data: nodeData
            };

            if (nodeData.parent === undefined )
            {
                delete newNode.data.parent;
            }

            if (posData)
            {
                newNode.position =
                {
                    x: posData.x,
                    y: posData.y
                }
            }
            nodeArr[i] = newNode;
        }

        this.cy.add(nodeArr);
        this.cy.nodes().updateCompoundBounds();

    };

    EditorActionsManager.prototype.addNodetoCy = function(nodeData, posData)
    {
        var newNode =
        {
            group: "nodes",
            data: nodeData
        };

        if (nodeData.parent === undefined )
        {
            delete newNode.data.parent;
        }

        if (posData)
        {
            newNode.position =
            {
                x: posData.x,
                y: posData.y
            }
        }

        //this.cy.add(newNode);
        this.cy.nodes().updateCompoundBounds();
        window.undoRedoManager.do("add", newNode);
    };

    EditorActionsManager.prototype.realTimeNodeAddRemoveEventCallBack = function(event)
    {
        //Get real time node object and sync it to node addition or removal
        var node = event.newValue;
        var nodeID = event.property;

        //Removal Operation
        if (node === null)
        {
            //Remove element from existing graph
            var cyEle = this.cy.$("#" + nodeID);
            this.removeElementCy(cyEle);
            this.cy.nodes().updateCompoundBounds();
        }
        //Addition Operation
        else
        {
            this.addNewNodeLocally(node);
        }
    };

    EditorActionsManager.prototype.addNewNodeLocally = function(realtimeNode)
    {
        var nodeID = this.realTimeManager.getCustomObjId(realtimeNode);
        var nodeData =
        {
            id: nodeID,
            type: realtimeNode.type,
            name: realtimeNode.name,
            parent: realtimeNode.parent
        };

        if (realtimeNode.x != "undefined" && realtimeNode.y != "undefined")
        {
            this.addNodetoCy(nodeData, {x: realtimeNode.x, y: realtimeNode.y});
        }
        else
        {
            this.addNodetoCy(nodeData);
        }
        this.cy.nodes().updateCompoundBounds();
    };

    EditorActionsManager.prototype.addNewNodeToRealTime = function(nodeData, posData)
    {
        this.realTimeManager.addNewNode(nodeData,posData);
    };

    //Edge related functions
    EditorActionsManager.prototype.addEdge = function(edgeData)
    {
        if (this.isCollaborative)
        {
            this.addNewEdgeRealTime(edgeData);
        }
        else
        {
            this.addNewEdgetoCy(edgeData);
        }
    };

    EditorActionsManager.prototype.addEdges = function(edges)
    {
        for (var i in edges)
        {
            this.addEdge(edges[i].data);
        }
    };

    EditorActionsManager.prototype.addEdgesCy = function(edges)
    {
        var newEdges = [];


        for (var i in edges)
        {
            var newEdge =
            {
                group: "edges",
                data: edges[i].data
            };
            newEdges.push(newEdge);
        }
        cy.add(newEdges);
    };

    EditorActionsManager.prototype.addNewEdgeRealTime = function(edgeData)
    {
        this.realTimeManager.addNewEdge(edgeData);
    };

    EditorActionsManager.prototype.addNewEdgetoCy = function(edgeData)
    {
        var newEdge =
        {
            group: "edges",
            data: edgeData
        };

        window.undoRedoManager.do("add", newEdge);
    };

    EditorActionsManager.prototype.realTimeEdgeAddRemoveEventCallBack = function(event)
    {
        //Get real time edge object and sync it to node addition or removal
        var edge = event.newValue;
        var edgeID = event.property;

        //Removal Operation
        if (edge === null)
        {
            //Remove element from existing graph
            var cyEle = this.cy.$("#" + edgeID);
            this.removeElementCy(cyEle);
        }
        //Addition Operation
        else
        {
            this.addNewEdgeLocally(edge);
        }
    };

    EditorActionsManager.prototype.addNewElementsLocally = function(realTimeNodeArray, realTimeEdgeArray)
    {
        var nodeList = [];
        var nodeMap = {};

        for (var i in realTimeNodeArray)
        {
            var realTimeNode= realTimeNodeArray[i];

            var nodeID = this.realTimeManager.getCustomObjId(realTimeNode);
            var nodeData =
            {
                group: 'nodes',
                data:
                {
                    id: nodeID,
                    type: realTimeNode.type,
                    name: realTimeNode.name,
                    parent: realTimeNode.parent
                }
            };

            if (nodeData.data.parent === undefined )
            {
                delete nodeData.data.parent;
            }

            if (realTimeNode.x && realTimeNode.y)
            {
                nodeData.position =
                {
                    x: realTimeNode.x,
                    y: realTimeNode.y
                }
            }

            nodeMap[nodeID] = nodeData;
            nodeList.push(nodeData);
        }

        var edgeList = [];
        for (var i in realTimeEdgeArray)
        {
            var edge= realTimeEdgeArray[i];
            var edgeID = this.realTimeManager.getCustomObjId(edge);

            //If source and and target is somehow lost in remote model do not create this edge
            if(!(edge.source in nodeMap && edge.target in nodeMap))
                continue

            var edgeData =
            {
                group: 'edges',
                data:
                {
                    id: edgeID,
                    type: edge.type,
                    source: edge.source,
                    target: edge.target,
                    pubmedIDs: edge.pubmedIDs.asArray(),
                    name: edge.name
                }
            };

            edgeList.push(edgeData);
        }

        this.cy.add(nodeList);
        this.cy.add(edgeList);

        this.cy.nodes().updateCompoundBounds();
    }

    EditorActionsManager.prototype.addNewEdgeLocally = function(edge)
    {
        var edgeID = this.realTimeManager.getCustomObjId(edge);
        var edgeData =
        {
            id: edgeID,
            type: edge.type,
            source: edge.source,
            target: edge.target,
            pubmedIDs: edge.pubmedIDs.asArray(),
            name: edge.name
        };
        this.addNewEdgetoCy(edgeData);
    };

    //Removal functions
    EditorActionsManager.prototype.removeElement = function(ele)
    {
        if (this.isCollaborative)
        {
            this.removeElementsFromRealTime(ele);
        }
        else
        {
            this.removeElementsCy(ele);
        }
    };

    EditorActionsManager.prototype.removeElementCy = function(ele)
    {
        window.undoRedoManager.do("remove", ele);
    };

    EditorActionsManager.prototype.removeElementsCy = function(ele)
    {
        window.undoRedoManager.do("remove", ele);
    };

    EditorActionsManager.prototype.removeElementsFromRealTime = function(eles)
    {
        var self = this;
        eles.forEach(function (ele, i)
        {
            self.realTimeManager.removeElement(ele.id());
        });
    };

    EditorActionsManager.prototype.removeElementFromRealTime = function(ele)
    {
        this.realTimeManager.removeElement(ele.id());
    };

    EditorActionsManager.prototype.changeParents = function(eles, newParentId)
    {
        if(this.isCollaborative)
        {
            this.changeParentRealTime(eles, newParentId);
        }
        else
        {
            var parentData = newParentId ? newParentId : null;
            //this.changeParentCy(eles, newParentId);
            var param = {
                firstTime: true,
                parentData: parentData, // It keeps the newParentId (Just an id for each nodes for the first time)
                nodes: eles,
                posDiffX: 0,
                posDiffY: 0
            };
            window.undoRedoManager.do('changeParent', param);
        }
    };

    EditorActionsManager.prototype.changeParentCy = function(eles, newParentId)
    {
        var lockedNodes = {};
        var self = this;

        function removeNodes(nodes)
        {
            //Get removed edges first
            var removedEles = nodes.connectedEdges().remove();
            var children = nodes.children();

            if (children != null && children.length > 0)
            {
                children.forEach(function(childNode, i)
                {
                    lockedNodes[childNode.id()] = true;
                });

                removedEles = removedEles.union(removeNodes(children));
            }

            removedEles = removedEles.union(nodes.remove());
            self.cy.nodes().updateCompoundBounds();
            return removedEles;
        }


        var removedEles = removeNodes(eles);
        window.undoRedoManager.do("remove", removedEles);

        for (var i = 0; i < removedEles.length; i++)
        {
            var removedNode = removedEles[i];

            //Just alter the parent id of corresponding nodes !
            if (removedNode.isEdge() || lockedNodes[removedNode.id()])
            {
                continue;
            }

            removedNode._private.data.parent = newParentId;
            if(removedNode._private.parent){
                delete removedNode._private.parent;
            }
        }

        self.cy.add(removedEles);
        window.undoRedoManager.do("add", removedEles);
        self.cy.nodes().updateCompoundBounds();
    };

    EditorActionsManager.prototype.changeParentRealTime = function (eles, newParentId)
    {

        var classRef = this;
        function getTopLevelParents(eles)
        {
            var tpMostNodes = classRef.cy.collection();
            var parentMap = {};

            //Get all parents
            eles.forEach(function (node, index)
            {
                if(node.isParent())
                    parentMap[node.id()] = node;
            });

            //Get all parents
            eles.forEach(function (node, index)
            {
                var nodeParent = node.parent();

                if(parentMap[nodeParent.id()] === undefined)
                    tpMostNodes = tpMostNodes.union(node);
            });

            return tpMostNodes;
        }

        var NodeObj = function(nodeObj){
            this.nodeRef  = nodeObj;
            this.children = [];
        };

        var connectedEdges = eles.connectedEdges();
        // Traverses given elements and constructs subgraph relations
        // creates a nested structure into rootnodeObj
        function traverseNodes(eles, rootNodeObj)
        {
            eles.forEach(function (ele, index)
            {
                connectedEdges = connectedEdges.union(ele.connectedEdges());

                if(ele.isParent())
                {
                    rootNodeObj.children.push(new NodeObj(ele));
                    var lengthOfChildrenArray = rootNodeObj.children.length;
                    traverseNodes(ele.children(), rootNodeObj.children[lengthOfChildrenArray-1]);
                }
                else
                {
                    rootNodeObj.children.push(new NodeObj(ele));
                }
            });
        }

        //Create new collection
        var topMostNodes = getTopLevelParents(eles);

        var rootNodeR = new NodeObj(null);

        traverseNodes(topMostNodes, rootNodeR);
        this.realTimeManager.changeParent(rootNodeR, newParentId, connectedEdges);
    };

    EditorActionsManager.prototype.moveElements = function(ele, position)
    {
        var classRef = this;
        //Sync movement to real time api
        if(this.isCollaborative)
        {
            ele.forEach(function (ele,index)
            {
                classRef.realTimeManager.moveElement(ele);
            });
        }
    };

    EditorActionsManager.prototype.resizeElements = function(ele)
    {
        var previousWidth = ele.width();
        var previousHeight = ele.height();
        //Sync movement to real time api
        if(this.isCollaborative) {
            this.realTimeManager.resizeElement(ele, previousWidth, previousHeight);
        }
    };

    EditorActionsManager.prototype.mergeGraph = function(nodes, edges)
    {
        if (this.isCollaborative)
        {
            //Collaborative usage
            this.realTimeManager.mergeGraph(nodes,edges);
        }
        else
        {
            //Local usage file load
            this.mergeGraphCy(nodes,edges);
        }
        this.fitGraph();
    };

    EditorActionsManager.prototype.mergeGraphCy = function(nodes, edges)
    {
        //Define arrays and maps
        var nodesToBeAdded = [];
        var edgesToBeAdded = [];
        var nodeMap = {};

        //Iterate over nodes and find nodes that does not exist in current graph by looking their name
        for (var index in nodes)
        {
            var ele = nodes[index];
            nodeMap[ele.data.id] = ele;

            if (cy.filter('node[name = "'+ele.data.name+'"]').length <= 0)
            {
                delete ele.data.id;
                //TODO need to update parent ?
                nodesToBeAdded.push(ele);
            }
        }

        cy.add(nodesToBeAdded);

        //Iterate over all edges
        for (var index in edges)
        {
            //Get corresponding source and target node in merge file
            var ele = edges[index];
            var sourceNode = nodeMap[ele.data.source];
            var targetNode = nodeMap[ele.data.target];

            //Check if there are nodes with same name in current graph
            var cySourceNode = cy.nodes('[name="'+sourceNode.data.name+'"]');
            var cyTargetNode = cy.nodes('[name="'+targetNode.data.name+'"]');

            if (cySourceNode.length > 0)
            {
                ele.data.source = cySourceNode.id();
            }

            if (cyTargetNode.length > 0)
            {
                ele.data.target = cyTargetNode.id();
            }

            if (cyTargetNode.length < 0 && cySourceNode.length < 0 ) {
                continue;
            }

            var edgesBtw = cy.filter('edge[source = "'+cySourceNode.id()+'"][target = "'+cyTargetNode.id()+'"]');

            //We assume there could be one edge between source and target node with same type
            var isFound = false;
            edgesBtw.forEach(function(edge,i)
            {
                if (edge.data().type == ele.data.type)
                {
                    isFound = true;
                    return false;
                }
            });

            if (!isFound)
            {
                delete ele.data.id;
                edgesToBeAdded.push(ele);
            }
        }

        cy.add(edgesToBeAdded);
    };

    EditorActionsManager.prototype.fitGraph = function()
    {
        if(this.isCollaborative)
        {
            cy.fit(this.FIT_CONSTANT);
            var newState =
            {
                zoomLevel: cy.zoom(),
                panLevel: cy.pan()
            };
            this.updateGlobalOptions(newState);
        }
        else
        {
            cy.fit(this.FIT_CONSTANT);
        }
    }

    EditorActionsManager.prototype.loadFile = function(nodes, edges)
    {
        if (this.isCollaborative)
        {
            //Real time load graph
            this.loadfileRealTime(nodes,edges);
        }
        else
        {
            //Local usage file load
            this.loadFileCy(nodes,edges);
        }
        this.fitGraph();
    };

    EditorActionsManager.prototype.loadFileCy = function(nodes, edges)
    {
        //Remove all elements
        this.removeElementCy(cy.elements());
        this.addNodesCy(nodes);
        this.addEdgesCy(edges);
    };

    EditorActionsManager.prototype.loadfileRealTime = function(nodes, edges)
    {
        this.realTimeManager.loadGraph(nodes,edges);
    };

    EditorActionsManager.prototype.removeAllElements = function()
    {
        if (this.isCollaborative)
        {
            this.realTimeManager.removeAllElements();
        }
        else
        {
            cy.remove(cy.elements());
        }
    };

    EditorActionsManager.prototype.updateHighlight = function(ele, isHighlighted)
    {
        if (isHighlighted)
            window.undoRedoManager.do('highlightOthers', ele);
        else
            window.undoRedoManager.do('removeOtherHighlight', ele);
    };


    EditorActionsManager.prototype.updateVisibility = function(ele, isHighlighted)
    {
        if (isHighlighted)
            ele.hide();
        else
            ele.show();
    };

    EditorActionsManager.prototype.updateElementCallback = function(ele, id)
    {
        var eleID = id;
        var cyEle = this.cy.$("#" + eleID);
        //Common functionalities
        this.changeNameCy(cyEle, ele.name);

        if (cyEle.isNode())
        {
            cyEle.position({x: ele.x, y: ele.y});
            cyEle.style("width", ele.w + "px");
            cyEle.style("height", ele.h + "px");
            this.updateVisibility(cyEle, ele.isHidden);
            this.updateHighlight(cyEle, ele.isHighlighted);

            if(ele.isInvalidGene)
            {
                window.editorActionsManager.doHighlightInvalidGenes(cyEle);
              // window.undoRedoManager.do('highlightInvalidGenes', cyEle);
            }
            else
            {
                window.editorActionsManager.undoHighlightInvalidGenes(cyEle);
              // window.undoRedoManager.do('removeHighlightInvalidGenes', cyEle);
            }
        }
        else if(cyEle.isEdge())
        {
          var pubmedArray = ele.pubmedIDs.asArray();
          cyEle.data('pubmedIDs', pubmedArray);
        }
    };

    EditorActionsManager.prototype.getGenomicDataSVG = function(node)
    {
        return this.genomicDataOverlayManager.generateSVGForNode(node);
    }

    EditorActionsManager.prototype.removeGenomicData = function()
    {
        if(this.isCollaborative)
        {
            this.realTimeManager.clearGenomicData();
        }
        else
        {
            //TODO wrap this in afunction in genomic data overlay manager
            this.genomicDataOverlayManager.clearAllGenomicData();
            this.genomicDataOverlayManager.hideGenomicData();
            this.genomicDataOverlayManager.notifyObservers();
        }

    }

    EditorActionsManager.prototype.addGenomicData = function(genomicData)
    {
        var groupID = this.getEmptyGroupID();

        if(this.isCollaborative)
        {

            var parsedGenomicData = this.genomicDataOverlayManager.prepareGenomicDataRealTime(genomicData);
            this.realTimeManager.addGenomicData(parsedGenomicData.genomicDataMap);
            this.realTimeManager.groupGenomicData(Object.keys(parsedGenomicData.visibilityMap),
                groupID);
            this.realTimeManager.addGenomicVisibilityData(parsedGenomicData.visibilityMap);

        }
        else
        {
            this.genomicDataOverlayManager.addGenomicDataLocally(genomicData, groupID);
        }
    }

    EditorActionsManager.prototype.addPortalGenomicData = function(genomicData, groupID)
    {
        if(this.isCollaborative)
        {
            var parsedGenomicData = this.genomicDataOverlayManager.preparePortalGenomicDataRealTime(genomicData);
            this.realTimeManager.addGenomicData(parsedGenomicData.genomicDataMap);
            this.realTimeManager.groupGenomicData(Object.keys(parsedGenomicData.visibilityMap),
                groupID);
            this.realTimeManager.addGenomicVisibilityData(parsedGenomicData.visibilityMap);
        }
        else
        {
            this.genomicDataOverlayManager.addPortalGenomicData(genomicData, groupID);
        }
    }

    EditorActionsManager.prototype.realTimeGenomicDataHandler = function(event)
    {
        var newData = event.newValue;
        var geneSymbol = event.property;

        if(newData)
        {
            this.genomicDataOverlayManager.addGenomicData(geneSymbol, newData);
        }
        //Removal
        else
        {
            this.genomicDataOverlayManager.removeGenomicData(geneSymbol);
        }
    }


    EditorActionsManager.prototype.realTimeGenomicDataGroupChangeHandler = function(event)
    {
        var data = event.newValue;
        var key = event.property;

        //Addition
        if(data != undefined)
        {
            this.genomicDataOverlayManager.addGenomicGroupData(key, data);
        }
        // //Removal
        // else
        // {
        //
        // }
        this.genomicDataOverlayManager.showGenomicData();
        this.genomicDataOverlayManager.notifyObservers();
    }

    EditorActionsManager.prototype.realTimeGenomicDataVsibilityHandler = function(event)
    {

        var data = event.newValue;
        var key = event.property;

        //Addition
        if(data != undefined)
        {
            this.genomicDataOverlayManager.addGenomicVisData(key, data);
        }
        //Removal
        else
        {
            this.genomicDataOverlayManager.removeGenomicVisData(data);
        }

        this.genomicDataOverlayManager.showGenomicData();
        this.genomicDataOverlayManager.notifyObservers();
    }

    //Utility Functions
    //TODO move functions thar are inside class functions here

    return EditorActionsManager;

})();
