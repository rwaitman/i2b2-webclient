/**
 * @projectDescription	Event controller for CRC's Query Tool.
 * @inherits 	i2b2.CRC.ctrlr
 * @namespace	i2b2.CRC.ctrlr.QT
 * @author		Nick Benik, Griffin Weber MD PhD
 * @version 	1.3
 * ----------------------------------------------------------------------------------------
 * updated 9-15-08: RC4 launch [Nick Benik] 
 */
console.group('Load & Execute component file: CRC > ctrlr > QueryTool');
console.time('execute time');
 
 
i2b2.CRC.ctrlr.QT = new QueryToolController();
function QueryToolController() {
	i2b2.CRC.model.queryCurrent = {};
	this.queryIsDirty = true;
	this.queryIsRunning = false;
	this.queryNamePrompt = false;
	this.queryTiming = 'ANY';
	this.hasModifier = false;
	this.queryNameDefault = 'New Query';
	this.queryStatusDefaultText = 'Drag query items to one or more groups then click Run Query.';
	this.panelControllers = [];
	this.panelControllers[0] = new i2b2_PanelController(this);
	this.panelControllers[1] = new i2b2_PanelController(this);
	this.panelControllers[2] = new i2b2_PanelController(this);
// ================================================================================================== //
	this.doSetQueryName = function(inName) {
		this.queryIsDirty = true;
		$('queryName').innerHTML = inName;
		i2b2.CRC.model.queryCurrent.name = inName;
	}

// ================================================================================================== //
	this.doQueryClear = function() {
		// function to clear query from memory
		delete i2b2.CRC.model.queryCurrent;
		i2b2.CRC.model.queryCurrent = {};
		var dm = i2b2.CRC.model.queryCurrent;
		dm.panels = [];
		this.doSetQueryName.call(this,'');
		this.doShowFrom(0);
		this._redrawPanelCount();
		this.queryNamePrompt = false;
		this.queryIsDirty = true;
		this.hasModifier = false;
		$('infoQueryStatusText').innerHTML = "";
		i2b2.CRC.view.QT.setQueryTiming(0);
	}

// ================================================================================================== //
	this.doQueryLoad = function(qm_id) {  // function to load query from history
		// clear existing query
		i2b2.CRC.ctrlr.QT.doQueryClear();
		// show on GUI that work is being done
		i2b2.h.LoadingMask.show();

		// callback processor
		var scopedCallback = new i2b2_scopedCallback();
		scopedCallback.scope = this;
		scopedCallback.callback = function(results) {
			var cl_queryMasterId = qm_id;
			// THIS function is used to process the AJAX results of the getChild call
			//		results data object contains the following attributes:
			//			refXML: xmlDomObject <--- for data processing
			//			msgRequest: xml (string)
			//			msgResponse: xml (string)
			//			error: boolean
			//			errorStatus: string [only with error=true]
			//			errorMsg: string [only with error=true]
			i2b2.CRC.view.QT.queryRequest = results.msgRequest;
			i2b2.CRC.view.QT.queryResponse = results.msgResponse;
			// switch to status tab
			i2b2.CRC.view.status.showDisplay();
			// did we get a valid query definition back? 
			var qd = i2b2.h.XPath(results.refXML, 'descendant::query_name/..');
			if (qd.length != 0) {
				i2b2.CRC.ctrlr.QT.doQueryClear();
				var dObj = {};
				dObj.name = i2b2.h.getXNodeVal(results.refXML,'name');
					$('queryName').innerHTML = dObj.name;
				dObj.timing = i2b2.h.getXNodeVal(qd[0],'query_timing');
				//i2b2.CRC.view.QT.queryTimingButtonset("label", dObj.timing);
				i2b2.CRC.view.QT.setQueryTiming(dObj.timing);
				dObj.specificity = i2b2.h.getXNodeVal(qd[0],'specificity_scale');
				dObj.panels = [];
				var qp = i2b2.h.XPath(qd[0], 'descendant::panel');
				var total_panels = qp.length;
				for (var i1=0; i1<total_panels; i1++) {
					// extract the data for each panel
					var po = {};
					po.panel_num = i2b2.h.getXNodeVal(qp[i1],'panel_number');
					var t = i2b2.h.getXNodeVal(qp[i1],'invert');
					po.exclude = (t=="1");
					// 1.4 queries don't have panel_timing, and undefined doesn't work
					// so default to ANY
					po.timing = i2b2.h.getXNodeVal(qp[i1],'panel_timing') || 'ANY';
					i2b2.CRC.view.QT.setPanelTiming(po.panel_num, po.timing);
					var t = i2b2.h.getXNodeVal(qp[i1],'total_item_occurrences');
					po.occurs = (1*t)-1;
					var t = i2b2.h.getXNodeVal(qp[i1],'panel_date_from');
					if (t) {
						t = t.replace('Z','');
						t = t.split('-');
						po.dateFrom = {};
						po.dateFrom.Year = t[0];
						po.dateFrom.Month = t[1];
						po.dateFrom.Day = t[2];
					} else {
						po.dateFrom = false;
					}
					var t = i2b2.h.getXNodeVal(qp[i1],'panel_date_to');
					if (t) {
						t = t.replace('Z','');
						t = t.split('-');
						po.dateTo = {};
						po.dateTo.Year = t[0];
						po.dateTo.Month = t[1];
						po.dateTo.Day = t[2];
					} else {
						po.dateTo = false;
					}
					po.items = [];
					var pi = i2b2.h.XPath(qp[i1], 'descendant::item[item_key]');
					for (i2=0; i2<pi.length; i2++) {
						var item = {};
						// get the item's details from the ONT Cell
						var ckey = i2b2.h.getXNodeVal(pi[i2],'item_key');
						
						
						// Determine what item this is
						if (ckey.startsWith("query_master_id")) {
							var o = new Object;
							o.name =i2b2.h.getXNodeVal(pi[i2],'item_name');
							o.id = ckey.substring(16);
							o.result_instance_id = o.PRS_id ;

							var sdxDataNode = i2b2.sdx.Master.EncapsulateData('QM',o);
							po.items.push(sdxDataNode);								
						} else if (ckey.startsWith("patient_set_coll_id")) {
							var o = new Object;
							o.titleCRC =i2b2.h.getXNodeVal(pi[i2],'item_name');
							o.PRS_id = ckey.substring(20);
							o.result_instance_id = o.PRS_id ;

							var sdxDataNode = i2b2.sdx.Master.EncapsulateData('PRS',o);
							po.items.push(sdxDataNode);		
						} else if (ckey.startsWith("patient_set_enc_id")) {
							var o = new Object;
							o.titleCRC =i2b2.h.getXNodeVal(pi[i2],'item_name');
							o.PRS_id = ckey.substring(19);
							o.result_instance_id = o.PRS_id ;

							var sdxDataNode = i2b2.sdx.Master.EncapsulateData('ENS',o);
							po.items.push(sdxDataNode);		
								
						} else {
							//Get the modfier if it exists
					//		if (i2b2.h.getXNodeVal(pi[i2],'constrain_by_modifier') != null)
					//		{
					//			po.modifier_key = i2b2.h.getXNodeVal(pi[i2],'constrain_by_modifier/modifier_key');
					//			po.applied_path = i2b2.h.getXNodeVal(pi[i2],'constrain_by_modifier/applied_path');
					//		}
							
							
							// WE MUST QUERY THE ONT CELL TO BE ABLE TO DISPLAY THE TREE STRUCTURE CORRECTLY

								var o = new Object;
								o.level = i2b2.h.getXNodeVal(pi[i2],'hlevel');
								o.name = i2b2.h.getXNodeVal(pi[i2],'item_name');
								o.key = i2b2.h.getXNodeVal(pi[i2],'item_key');
								o.synonym_cd = i2b2.h.getXNodeVal(pi[i2],'item_is_synonym');
								o.tooltip = i2b2.h.getXNodeVal(pi[i2],'tooltip');
								o.hasChildren = i2b2.h.getXNodeVal(pi[i2],'item_icon');
								
								//o.xmlOrig = c;
								
								// Lab Values processing
								var lvd = i2b2.h.XPath(pi[i2], 'descendant::constrain_by_value');
								if ((lvd.length>0) && (i2b2.h.XPath(pi[i2], 'descendant::constrain_by_modifier').length == 0)){
									lvd = lvd[0];
									// pull the LabValue definition for concept
									// extract & translate
									var t = i2b2.h.getXNodeVal(lvd,"value_constraint");
									o.LabValues = {};
									o.LabValues.NumericOp = i2b2.h.getXNodeVal(lvd,"value_operator");
									o.LabValues.GeneralValueType = i2b2.h.getXNodeVal(lvd,"value_type");								
									switch(o.LabValues.GeneralValueType) {
										case "NUMBER":
											o.LabValues.MatchBy = "VALUE";
											if (t.indexOf(' and ')!=-1) {
												// extract high and low values
												t = t.split(' and ');
												o.LabValues.ValueLow = t[0];
												o.LabValues.ValueHigh = t[1];
											} else {
												o.LabValues.Value = t;
											}
											break;
										case "STRING":
											o.LabValues.MatchBy = "VALUE";
											o.LabValues.ValueString = t;
											break;
										case "TEXT":	// this means Enum?
											o.LabValues.MatchBy = "VALUE";
											try {
												o.LabValues.ValueEnum = eval("(Array"+t+")");
												o.LabValues.GeneralValueType = "ENUM";																									
											} catch(e) {
												//is a string
												o.LabValues.StringOp = i2b2.h.getXNodeVal(lvd,"value_operator");
												o.LabValues.ValueString = t;
												o.LabValues.GeneralValueType = "STRING";	
												//i2b2.h.LoadingMask.hide();
												//("Conversion Failed: Lab Value data = "+t);
											}
											break;
										case "FLAG":
											o.LabValues.MatchBy = "FLAG";
											o.LabValues.ValueFlag = t
											break;		
										default:
											o.LabValues.Value = t;
									}		
								}
								// sdx encapsulate
								var sdxDataNode = i2b2.sdx.Master.EncapsulateData('CONCPT',o);
								if (o.LabValues) {
									// We do want 2 copies of the Lab Values: one is original from server while the other one is for user manipulation
									sdxDataNode.LabValues = o.LabValues;
								}
										//o.xmlOrig = c;
										if (i2b2.h.XPath(pi[i2], 'descendant::constrain_by_modifier').length > 0) {
									//if (i2b2.h.getXNodeVal(pi[i2],'constrain_by_modifier') != null) {
										sdxDataNode.origData.parent = {};
										sdxDataNode.origData.parent.key = o.key;
										//sdxDataNode.origData.parent.LabValues = o.LabValues;
										sdxDataNode.origData.parent.hasChildren = o.hasChildren;
										sdxDataNode.origData.parent.level = o.level;
										sdxDataNode.origData.parent.name = o.name;
										sdxDataNode.origData.key = i2b2.h.getXNodeVal(pi[i2],'constrain_by_modifier/modifier_key');
										sdxDataNode.origData.applied_path = i2b2.h.getXNodeVal(pi[i2],'constrain_by_modifier/applied_path');
										sdxDataNode.origData.name = i2b2.h.getXNodeVal(pi[i2],'constrain_by_modifier/modifier_name');
										sdxDataNode.origData.isModifier = true;
										this.hasModifier = true;
										
										// Lab Values processing
										var lvd = i2b2.h.XPath(pi[i2], 'descendant::constrain_by_modifier/constrain_by_value');
										if (lvd.length>0){
											lvd = lvd[0];
											// pull the LabValue definition for concept

											// extract & translate
											var t = i2b2.h.getXNodeVal(lvd,"value_constraint");
											o.ModValues = {};
											o.ModValues.NumericOp = i2b2.h.getXNodeVal(lvd,"value_operator");
											o.ModValues.GeneralValueType = i2b2.h.getXNodeVal(lvd,"value_type");								
											switch(o.ModValues.GeneralValueType) {
												case "NUMBER":
													o.ModValues.MatchBy = "VALUE";
													if (t.indexOf(' and ')!=-1) {
														// extract high and low values
														t = t.split(' and ');
														o.ModValues.ValueLow = t[0];
														o.ModValues.ValueHigh = t[1];
													} else {
														o.ModValues.Value = t;
													}
													break;
												case "STRING":
													o.ModValues.MatchBy = "VALUE";
													o.ModValues.ValueString = t;
													break;
												case "TEXT":	// this means Enum?
													o.ModValues.MatchBy = "VALUE";
													try {
														o.ModValues.ValueEnum = eval("(Array"+t+")");
														o.ModValues.GeneralValueType = "ENUM";													
													} catch(e) {
														o.LabValues.StringOp = i2b2.h.getXNodeVal(lvd,"value_operator");
														o.LabValues.ValueString = t;
														
													//	i2b2.h.LoadingMask.hide();
													//	console.error("Conversion Failed: Lab Value data = "+t);
													}
													break;
												case "FLAG":
													o.ModValues.MatchBy = "FLAG";
													o.ModValues.ValueFlag = t
													break;		
												default:
													o.ModValues.Value = t;
											}		
										}
										// sdx encapsulate
										//var sdxDataNode = i2b2.sdx.Master.EncapsulateData('CONCPT',o);
										if (o.ModValues) {
											// We do want 2 copies of the Lab Values: one is original from server while the other one is for user manipulation
											sdxDataNode.ModValues = o.ModValues;
										}
									//}
											
								}
								
								
								po.items.push(sdxDataNode);
						//	} else {
						//		console.error("CRC's ONT Handler could not get term details about '"+ckey+"'!");
						//	}
							
						}
					}
					dObj.panels[po.panel_num] = po;
				}
				// reindex the panels index (panel [1,3,5] should be [0,1,2])
				dObj.panels = dObj.panels.compact();
				i2b2.CRC.model.queryCurrent = dObj;
				// populate the panels yuiTrees
				try {
					var qpc = i2b2.CRC.ctrlr.QT.panelControllers[0];
					var dm = i2b2.CRC.model.queryCurrent;
					for (var pi=0; pi<dm.panels.length; pi++) {
						// create a treeview root node and connect it to the treeview controller
						dm.panels[pi].tvRootNode = new YAHOO.widget.RootNode(qpc.yuiTree);
						qpc.yuiTree.root = dm.panels[pi].tvRootNode;
						dm.panels[pi].tvRootNode.tree = qpc.yuiTree;
						qpc.yuiTree.setDynamicLoad(i2b2.CRC.ctrlr.QT._loadTreeDataForNode,1);						
						// load the treeview with the data
						var tvRoot = qpc.yuiTree.getRoot();
						for (var pii=0; pii<dm.panels[pi].items.length; pii++) {
							var withRenderData = qpc._addConceptVisuals(dm.panels[pi].items[pii], tvRoot, false);
							if (dm.panels[pi].items[pii].ModValues)
							{
								withRenderData.ModValues = 	dm.panels[pi].items[pii].ModValues;
							}
							if (dm.panels[pi].items[pii].LabValues)
							{
								withRenderData.LabValues = 	dm.panels[pi].items[pii].LabValues;
							}
							
							dm.panels[pi].items[pii] = withRenderData;
						}
					}
				} catch (e) {}
				// redraw the Query Tool GUI
				i2b2.CRC.ctrlr.QT._redrawPanelCount();
				i2b2.CRC.ctrlr.QT.doScrollFirst();
				// hide the loading mask
				i2b2.h.LoadingMask.hide();
				}
									//Load the query status
				i2b2.CRC.ctrlr.QT.laodQueryStatus(qm_id, dObj.name);
		}
		// AJAX CALL
		i2b2.CRC.ajax.getRequestXml_fromQueryMasterId("CRC:QueryTool", { qm_key_value: qm_id }, scopedCallback);		


	}

// ================================================================================================== //
	this.doQueryRun = function() {
		// function to build and run query 
		if (i2b2.CRC.ctrlr.currentQueryStatus != false && i2b2.CRC.ctrlr.currentQueryStatus.isQueryRunning()) { 
			i2b2.CRC.ctrlr.currentQueryStatus.cancelQuery();
			i2b2.CRC.ctrlr.currentQueryStatus = false;
			//alert('A query is already running.\n Please wait until the currently running query has finished.');
			return void(0);
		}
		
		if (i2b2.CRC.model.queryCurrent.panels.length < 1) {
			alert('You must enter at least one concept to run a query.');
			return void(0);
		}
		
		// make sure a shrine topic has been selected
		if (i2b2.PM.model.shrine_domain) {
			var topicSELECT = $('queryTopicSelect');
			if (topicSELECT.selectedIndex == null || topicSELECT.selectedIndex == 0) {
				alert('You must select a Topic to run a SHRINE query.');
				return void(0);
			}
			var topicid = topicSELECT.options[topicSELECT.selectedIndex].value;
		}

		// callback for dialog submission
		var handleSubmit = function() {
			// submit value(s)
			if(this.submit()) {
				// run the query
				var t = $('dialogQryRun');
				var queryNameInput = t.select('INPUT.inputQueryName')[0];
				var options = {};
				var t2 = t.select('INPUT.chkQueryType');
				for (var i=0;i<t2.length; i++) {
					if (t2[i].checked == true) {
						options['chk_'+t2[i].value] = t2[i].checked;
					}
				}				
				$('queryName').innerHTML = queryNameInput.value;
				i2b2.CRC.model.queryCurrent.name = queryNameInput.value;
				i2b2.CRC.ctrlr.QT._queryRun(queryNameInput.value, options);
			}
		}
		// display the query name input dialog
		this._queryPromptRun(handleSubmit);
		// autogenerate query name
		var myDate=new Date();
		
		
		var hours = myDate.getHours()
		if (hours < 10){
			hours = "0" + hours
		}
		var minutes = myDate.getMinutes()
		if (minutes < 10){
			minutes = "0" + minutes
		}
		var seconds = myDate.getSeconds()
		if (seconds < 10){
			seconds = "0" + seconds
		}
		//var ds = myDate.toLocaleString();
		var ts = hours + ":" + minutes + ":" + seconds; //ds.substring(ds.length-5,ds.length-13);
		var defQuery = this._getQueryXML.call(this);
		var qn = defQuery.queryAutoName+'@'+ts;
		// display name
		var queryNameInput = $('dialogQryRun').select('INPUT.inputQueryName')[0];
		queryNameInput.value = qn;
	}

// ================================================================================================== //
	this._queryRun = function(inQueryName, options) {
		// make sure name is not blank
		if (inQueryName.blank()) { 
			alert('Cannot run query with without providing a name!');
			return;
		}
	//	if(!options.chk_PRS && !options.chk_PRC  && !options.chk_ENS) {
	//		alert('You must select at least one query result type to return!');
	//		return;
	//	}
		
		// Query Parameters
		var query_definition = this._getQueryXML(inQueryName);
		var params = {
			result_wait_time: i2b2.CRC.view.QT.params.queryTimeout,
			psm_query_definition: query_definition.queryXML
		}
		// SHRINE topic if we are running SHRINE query
		if (i2b2.h.isSHRINE()) {
			var topicSELECT = $('queryTopicSelect');
			if (topicSELECT.selectedIndex == null || topicSELECT.selectedIndex == 0) {
				alert("Please select a Topic to run the query.");
				return false;
			}
			params.shrine_topic = "<shrine><queryTopicID>"+topicSELECT.options[topicSELECT.selectedIndex].value+"</queryTopicID></shrine>";
		}
		
		// generate the result_output_list (for 1.3 backend)
		
			var result_output = "";
		/*
		var i=0;
		if (options.chk_PRS) {
			i++;
			result_output += '<result_output priority_index="'+i+'" name="patientset"/>';
		}
		if (options.chk_ENS) {
			i++;
			result_output += '<result_output priority_index="'+i+'" name="patient_encounter_set"/>';
		}
		if (options.chk_PRC) {
			i++;
			result_output += '<result_output priority_index="'+i+'" name="patient_count_xml"/>';
		}
		*/
		for(var name in options)
		{
			if (name) {
				i++;
				result_output += '<result_output priority_index="'+i+'" name="' + name.substring(4).toLowerCase() + '"/>\n';	
			}

		}
		params.psm_result_output = '<result_output_list>'+result_output+'</result_output_list>\n';
		
		// create query object
		 $('runBoxText').innerHTML = "Cancel Query";
		i2b2.CRC.ctrlr.currentQueryStatus = new i2b2.CRC.ctrlr.QueryStatus($('infoQueryStatusText'));
		i2b2.CRC.ctrlr.currentQueryStatus.startQuery(inQueryName, params);		
	}


// ================================================================================================== //
	this._queryRunningTime = function() {
		if (i2b2.CRC.ctrlr.QT.queryIsRunning) {
			var d = new Date();
			var t = Math.floor((d.getTime() - queryStartTime)/100)/10;
			var el = $('numSeconds');
			if (el) {
				var s = t.toString();
				if (s.indexOf('.') < 0) {
					s += '.0';
				}
				el.innerHTML = s;
				window.setTimeout('i2b2.CRC.ctrlr.QT._queryRunningTime()',100);
			}
		}
	}


// ================================================================================================== //
	this._queryPromptRun = function(handleSubmit) {
		if (!i2b2.CRC.view.dialogQryRun) {
			var handleCancel = function() {
				this.cancel();
			};
			var loopBackSubmit = function() {
				i2b2.CRC.view.dialogQryRun.submitterFunction();
			};
			i2b2.CRC.view.dialogQryRun = new YAHOO.widget.SimpleDialog("dialogQryRun", {
					width: "400px",
					fixedcenter: true,
					constraintoviewport: true,
					modal: true,
					zindex: 700,
					buttons: [{
						text: "OK",
						handler: loopBackSubmit,
						isDefault: true
					}, {
						text: "Cancel",
						handler: handleCancel
					}]
				});
			$('dialogQryRun').show();
			i2b2.CRC.view.dialogQryRun.validate = function(){
				// now process the form data
				var msgError = '';
				var queryNameInput = $('dialogQryRun').select('INPUT.inputQueryName')[0];
				if (!queryNameInput || queryNameInput.value.blank()) {
					alert('Please enter a name for this query.');
					return false;
				}
				return true;
			};
			i2b2.CRC.view.dialogQryRun.render(document.body);
		}
		// manage the event handler for submit
		delete i2b2.CRC.view.dialogQryRun.submitterFunction;
		i2b2.CRC.view.dialogQryRun.submitterFunction = handleSubmit;
		// display the dialoge
		i2b2.CRC.view.dialogQryRun.center();
		i2b2.CRC.view.dialogQryRun.show();
	}


// ================================================================================================== //
	this._queryPromptName = function(handleSubmit) {
		if (!i2b2.CRC.view.dialogQmName) {
			var handleCancel = function() {
				this.cancel();
			};
			var loopBackSubmit = function() {
				i2b2.CRC.view.dialogQmName.submitterFunction();
			};
			i2b2.CRC.view.dialogQmName = new YAHOO.widget.SimpleDialog("dialogQmName", {
					width: "400px",
					fixedcenter: true,
					constraintoviewport: true,
					modal: true,
					zindex: 700,
					buttons: [{
						text: "OK",
						handler: loopBackSubmit,
						isDefault: true
					}, {
						text: "Cancel",
						handler: handleCancel
					}]
				});
			$('dialogQmName').show();
			i2b2.CRC.view.dialogQmName.validate = function(){
				// now process the form data
				var msgError = '';
				var queryNameInput = $('inputQueryName');
				if (!queryNameInput || queryNameInput.value.blank()) {
					alert('Please enter a name for this query.');
					return false;
				}
				return true;
			};
			i2b2.CRC.view.dialogQmName.render(document.body);
		}
		// manage the event handler for submit
		delete i2b2.CRC.view.dialogQmName.submitterFunction;
		i2b2.CRC.view.dialogQmName.submitterFunction = handleSubmit;
		// display the dialoge
		i2b2.CRC.view.dialogQmName.center();
		i2b2.CRC.view.dialogQmName.show();
	}

// ================================================================================================== //
	this._getQueryXML = function(queryName) {
		var i;
		var el;
		var concept;
		var panel_list = i2b2.CRC.model.queryCurrent.panels
		var panel_cnt = panel_list.length;
		var auto_query_name_len = 15;
		var auto_query_name = '';
		if (panel_cnt > 0) {
			auto_query_name_len = Math.floor(15/panel_cnt);
			if (auto_query_name_len < 1) {auto_query_name_len = 1;}
		}
		// build Query XML
		var s = '<query_definition>\n';
		s += '\t<query_name>' + i2b2.h.Escape(queryName) + '</query_name>\n';
		if (this.queryTiming == "SAMEVISIT")
		{
			s += '\t<query_timing>SAMEVISIT</query_timing>\n';			
		} else if (this.queryTiming == "ANY") {
			s += '\t<query_timing>ANY</query_timing>\n';						
		} else {
			s += '\t<query_timing>SAMEINSTANCENUM</query_timing>\n';
		}
		s += '\t<specificity_scale>0</specificity_scale>\n';
		if (i2b2.PM.model.shrine_domain) { s += '\t<use_shrine>1</use_shrine>\n'; }
		for (var p = 0; p < panel_cnt; p++) {
			s += '\t<panel>\n';
			s += '\t\t<panel_number>' + (p+1) + '</panel_number>\n';
			// date range constraints
			if (panel_list[p].dateFrom) {
				s += '\t\t<panel_date_from>'+panel_list[p].dateFrom.Year+'-'+padNumber(panel_list[p].dateFrom.Month,2)+'-'+padNumber(panel_list[p].dateFrom.Day,2)+'Z</panel_date_from>\n';
			}
			if (panel_list[p].dateTo) {
				s += '\t\t<panel_date_to>'+panel_list[p].dateTo.Year+'-'+padNumber(panel_list[p].dateTo.Month,2)+'-'+padNumber(panel_list[p].dateTo.Day,2)+'Z</panel_date_to>\n';
			}
			s += "\t\t<panel_accuracy_scale>0</panel_accuracy_scale>\n";
			// Exclude constraint (invert flag)
			if (panel_list[p].exclude) {
				s += '\t\t<invert>1</invert>\n';
			} else {
				s += '\t\t<invert>0</invert>\n';
			}
			// Panel Timing
			s += '\t\t<panel_timing>' + panel_list[p].timing + '</panel_timing>\n';
			// Occurs constraint
			s += '\t\t<total_item_occurrences>'+((panel_list[p].occurs*1)+1)+'</total_item_occurrences>\n';
			// Concepts
			for (i=0; i < panel_list[p].items.length; i++) {
				var sdxData = panel_list[p].items[i];
				s += '\t\t<item>\n';
					switch(sdxData.sdxInfo.sdxType) {
					case "QM":	
						s += '\t\t\t<item_key>masterid:' + sdxData.origData.id + '</item_key>\n';
						s += '\t\t\t<item_name>' + sdxData.origData.title + '</item_name>\n';
						s += '\t\t\t<tooltip>' + sdxData.origData.name + '</tooltip>\n';
						s += '\t\t\t<item_is_synonym>false</item_is_synonym>\n';
						s += '\t\t\t<hlevel>0</hlevel>\n';
					break;
					case "PRS":	
						s += '\t\t\t<item_key>patient_set_coll_id:' + sdxData.sdxInfo.sdxKeyValue + '</item_key>\n';
						s += '\t\t\t<item_name>' + sdxData.sdxInfo.sdxDisplayName + '</item_name>\n';
						s += '\t\t\t<tooltip>' + sdxData.sdxInfo.sdxDisplayName + '</tooltip>\n';
						s += '\t\t\t<item_is_synonym>false</item_is_synonym>\n';
						s += '\t\t\t<hlevel>0</hlevel>\n';
					break;
					case "ENS":	
						s += '\t\t\t<item_key>patient_set_enc_id:' + sdxData.sdxInfo.sdxKeyValue + '</item_key>\n';
						s += '\t\t\t<item_name>' + sdxData.sdxInfo.sdxDisplayName + '</item_name>\n';
						s += '\t\t\t<tooltip>' + sdxData.sdxInfo.sdxDisplayName + '</tooltip>\n';
						s += '\t\t\t<item_is_synonym>false</item_is_synonym>\n';
						s += '\t\t\t<hlevel>0</hlevel>\n';
					break;
					default:
						if (sdxData.origData.isModifier) {
							s += '\t\t\t<hlevel>' + sdxData.origData.level + '</hlevel>\n';
							s += '\t\t\t<item_key>' + sdxData.origData.parent.key + '</item_key>\n';
							s += '\t\t\t<item_name>' +  (sdxData.origData.parent.name != null ? sdxData.origData.parent.name : sdxData.origData.name) + '</item_name>\n';
							// (sdxData.origData.newName != null ? sdxData.origData.newName : sdxData.origData.name) + '</item_name>\n';
							s += '\t\t\t<tooltip>' + sdxData.origData.tooltip + '</tooltip>\n';
							s += '\t\t\t<item_icon>' + sdxData.origData.hasChildren + '</item_icon>\n';
							s += '\t\t\t<class>ENC</class>';

                         	s += '\t\t\t\t<constrain_by_modifier>\n';
                            s += '\t\t\t\t\t<modifier_name>' + sdxData.origData.name + '</modifier_name>\n';
                            s += '\t\t\t\t\t<applied_path>' + sdxData.origData.applied_path + '</applied_path>\n';
                            s += '\t\t\t\t\t<modifier_key>' + sdxData.origData.key + '</modifier_key>\n';
							if (sdxData.ModValues)
							{
								s += this.getValues( sdxData.ModValues);
							}
							
                        	s += '\t\t\t\t</constrain_by_modifier>\n';					
						} else {
							s += '\t\t\t<hlevel>' + sdxData.origData.level + '</hlevel>\n';
							s += '\t\t\t<item_name>' + (sdxData.origData.newName != null ? sdxData.origData.newName : sdxData.origData.name) + '</item_name>\n';
							s += '\t\t\t<item_key>' + sdxData.origData.key + '</item_key>\n';
							s += '\t\t\t<tooltip>' + sdxData.origData.tooltip + '</tooltip>\n';
							s += '\t\t\t<class>ENC</class>\n';
							s += '\t\t\t<item_icon>' + sdxData.origData.hasChildren + '</item_icon>\n';	
						}
							try {
								var t = i2b2.h.XPath(sdxData.origData.xmlOrig,'descendant::synonym_cd/text()');
								t = (t[0].nodeValue=="Y");
							} catch(e) {
								var t = "false";
							}
							s += '\t\t\t<item_is_synonym>'+t+'</item_is_synonym>\n';
							
						if (sdxData.LabValues) {
							//s += '\t\t\t<constrain_by_value>\n';
							s += this.getValues( sdxData.LabValues);
						}
						
					break;
				}
				//TODO add contraint to the item in the future
				/*
						s += '\t\t\t<constrain_by_date>\n';
						if (panel_list[p].dateFrom) {
							s += '\t\t\t\t<date_from>'+panel_list[p].dateFrom.Year+'-'+padNumber(panel_list[p].dateFrom.Month,2)+'-'+padNumber(panel_list[p].dateFrom.Day,2)+'Z</date_from>\n';
						}
						if (panel_list[p].dateTo) {
							s += '\t\t\t\t<date_to>'+panel_list[p].dateTo.Year+'-'+padNumber(panel_list[p].dateTo.Month,2)+'-'+padNumber(panel_list[p].dateTo.Day,2)+'Z</date_to>\n';
						}
						s += '\t\t\t</constrain_by_date>\n';	
				*/
				s += '\t\t</item>\n';
				if (i==0) {
					if (undefined != sdxData.origData.name) {
						auto_query_name += sdxData.origData.name.substring(0,auto_query_name_len);
					} else if (undefined != sdxData.origData.title) {
						auto_query_name += sdxData.origData.title.substring(0,auto_query_name_len);					
					} else {
						auto_query_name += "new query";
					}
					
					if (p < panel_cnt-1) {auto_query_name += '-';}
				}
			}
			s += '\t</panel>\n';
		}
		s += '</query_definition>\n';
		this.queryMsg = {};
		this.queryMsg.queryAutoName = auto_query_name;
		if (undefined===queryName) {
			this.queryMsg.queryName = this.queryNameDefault;
		} else {
			this.queryMsg.queryName = queryName;				
		}
		this.queryMsg.queryXML = s;
		return(this.queryMsg);
	}

	this.getValues = function(lvd) {
							var s = '\t\t\t<constrain_by_value>\n';
							//var lvd = sdxData.LabValues;
							switch(lvd.MatchBy) {
								case "FLAG":
									s += '\t\t\t\t<value_type>FLAG</value_type>\n';
									s += '\t\t\t\t<value_operator>EQ</value_operator>\n';
									s += '\t\t\t\t<value_constraint>'+i2b2.h.Escape(lvd.ValueFlag)+'</value_constraint>\n';
									break;
								case "VALUE":
									if (lvd.GeneralValueType=="ENUM") {
										var sEnum = [];
										for (var i2=0;i2<lvd.ValueEnum.length;i2++) {
											sEnum.push(i2b2.h.Escape(lvd.ValueEnum[i2]));
										}
										//sEnum = sEnum.join("\", \"");
										sEnum = sEnum.join("\',\'");
										sEnum = '(\''+sEnum+'\')';
										s += '\t\t\t\t<value_type>TEXT</value_type>\n';
										s += '\t\t\t\t<value_constraint>'+sEnum+'</value_constraint>\n';
										s += '\t\t\t\t<value_operator>IN</value_operator>\n';								
									} else if (lvd.GeneralValueType=="STRING") {
										s += '\t\t\t\t<value_type>TEXT</value_type>\n';
										s += '\t\t\t\t<value_operator>'+lvd.StringOp+'</value_operator>\n';
										s += '\t\t\t\t<value_constraint><![CDATA['+i2b2.h.Escape(lvd.ValueString)+']]></value_constraint>\n';
									} else {
										s += '\t\t\t\t<value_type>'+lvd.GeneralValueType+'</value_type>\n';
										s += '\t\t\t\t<value_unit_of_measure>'+lvd.UnitsCtrl+'</value_unit_of_measure>\n';
										s += '\t\t\t\t<value_operator>'+lvd.NumericOp+'</value_operator>\n';
										if (lvd.NumericOp == 'BETWEEN') {
											s += '\t\t\t\t<value_constraint>'+i2b2.h.Escape(lvd.ValueLow)+' and '+i2b2.h.Escape(lvd.ValueHigh)+'</value_constraint>\n';
										} else {
											s += '\t\t\t\t<value_constraint>'+i2b2.h.Escape(lvd.Value)+'</value_constraint>\n';
										}
									}
									break;
								case "":
									break;
							}
							s += '\t\t\t</constrain_by_value>\n';
		return s;
	}
	

// ================================================================================================== //
	this.panelAdd = function(yuiTree) {
		// this function is used to create a new panel, it initializes the data structure in the 
		if (!i2b2.CRC.model.queryCurrent.panels) { i2b2.CRC.model.queryCurrent.panels = []}
		var dm = i2b2.CRC.model.queryCurrent;
		var pi = dm.panels.length;
		// setup the data model for this panel
		dm.panels[pi] = {};
		dm.panels[pi].dateTo = false;
		dm.panels[pi].dateFrom = false;
		dm.panels[pi].exclude = false;
		dm.panels[pi].occurs = '0';
		dm.panels[pi].timing = i2b2.CRC.ctrlr.QT.queryTiming; //'ANY';
		dm.panels[pi].items = [];
		// create a treeview root node and connect it to the treeview controller
		dm.panels[pi].tvRootNode = new YAHOO.widget.RootNode(this.yuiTree);
		yuiTree.root = dm.panels[pi].tvRootNode;
		dm.panels[pi].tvRootNode.tree = yuiTree;
		yuiTree.setDynamicLoad(i2b2.CRC.ctrlr.QT._loadTreeDataForNode,1);
		// update the count on the GUI
		this._redrawPanelCount();
		// return a reference to the new panel object
		this.doSetQueryName.call(this,'');
		return dm.panels[pi];
	}

// ================================================================================================== //
	this._loadTreeDataForNode = function(node, onCompleteCallback) {
		i2b2.sdx.Master.LoadChildrenFromTreeview(node, onCompleteCallback);
	}

// ================================================================================================== //
	this.ToggleNode = function(divTarg, divTreeID) {
		// get the i2b2 data from the yuiTree node
		var tvTree = YAHOO.widget.TreeView.findTreeByChildDiv(divTarg);  // this is a custom extention found in "hive_helpers.js"
		var tvNode = tvTree.getNodeByProperty('nodeid', divTarg.id);
		tvNode.toggle();
	}

// ================================================================================================== //
	this.panelDelete = function(index) {
		// alter the data model's panel elements
		var dm = i2b2.CRC.model.queryCurrent;
		if(index <0 || index>=dm.panels.length) { return false;}
		dm.panels.splice(index,1);
		// redraw the panels
		this.doShowFrom(this.panelControllers[0].panelCurrentIndex);
		// BUG FIX: force the panels to fully reattach the yuiRootNode to the controllers
		for (var i=0; i<this.panelControllers.length; i++) {
			this.panelControllers[i].doRedraw();
		}		
		this._redrawPanelCount();
		this.doSetQueryName.call(this,'');
	}

// ================================================================================================== //
	this.doShowFrom = function(index_offset) {
		// have all panel controllers redraw using new index offest
		if (index_offset===false) { return true; }
		if (index_offset < 0) { index_offset = 0; }
		for (var i=0; i<3; i++) {
			this.panelControllers[i].refTitle.innerHTML = "Group "+(index_offset+i+1);
			this.panelControllers[i].setPanelRecord(index_offset+i);
			if (i > 0) {
				if (index_offset+i <= i2b2.CRC.model.queryCurrent.panels.length) {
					$('queryBalloonAnd'+(i)).style.display = 'block';
				} else {
					$('queryBalloonAnd'+(i)).style.display = 'none';
				}
			}
		}
		this._redrawScrollBtns();
	}

// ================================================================================================== //
	this._redrawAllPanels = function() {
		for (var i=0; i<3; i++) {
			this.panelControllers[i].doRedraw();
			if (i > 0) {
				if (this.panelControllers[i].panelCurrentIndex-1 < i2b2.CRC.model.queryCurrent.panels.length) {
					$('queryBalloonAnd'+(i)).style.display = 'block';
				} else {
					$('queryBalloonAnd'+(i)).style.display = 'none';
				}
			}
		}
	}

// ================================================================================================== //
	this._redrawPanelCount = function() {
		var c = i2b2.CRC.model.queryCurrent.panels.length; 
		if (c == 1) {
			var s = '1 Group';
		} else {
			var s = c + ' Groups';
		}
		$('groupCount').innerHTML = s;
	}

// ================================================================================================== //
	this.laodQueryStatus = function( queryMasterId, queryName) {
		
		var QRS = {};
		var newHTML = "";
		var  qi_id = "";
		$('infoQueryStatusText').innerHTML = "";

		var scopedCallbackQI = new i2b2_scopedCallback();
		scopedCallbackQI.scope = this;
		scopedCallbackQI.callback = function(results) {
			if (results.error) {
				alert(results.errorMsg);
				return;
			} else {
				// find our query instance
				var qi_list = results.refXML.getElementsByTagName('query_instance');
				var l = qi_list.length;
				for (var i=0; i<l; i++) {
					var temp = qi_list[i];
					qi_id = i2b2.h.XPath(temp, 'descendant-or-self::query_instance_id')[0].firstChild.nodeValue;
					
					
					var start_date = i2b2.h.XPath(temp, 'descendant-or-self::start_date')[0].firstChild.nodeValue;
						if (!Object.isUndefined(start_date)) {
							//alert(sDate.substring(0,4) + ":" + sDate.substring(5,7)  + ":" + sDate.substring(8,10));
							//012345678901234567890123
							//2010-12-21T16:12:01.427
							start_date =  new Date(start_date.substring(0,4), start_date.substring(5,7)-1, start_date.substring(8,10), start_date.substring(11,13), start_date.substring(14,16),start_date.substring(17,19),start_date.substring(20,23));
						}						
						var end_date = i2b2.h.XPath(temp, 'descendant-or-self::end_date')[0].firstChild.nodeValue;
						if (!Object.isUndefined(end_date)) {
							//alert(sDate.substring(0,4) + ":" + sDate.substring(5,7)  + ":" + sDate.substring(8,10));
							end_date =  new Date(end_date.substring(0,4), end_date.substring(5,7)-1,  end_date.substring(8,10),  end_date.substring(11,13),end_date.substring(14,16), end_date.substring(17,19), end_date.substring(20,23));
						}	
					
						$('infoQueryStatusText').innerHTML = '<div style="clear:both;"><div style="float:left; font-weight:bold">Finished Query: "'+queryName+'"</div>';
						$('infoQueryStatusText').innerHTML += '<div style="float:right">['+ (Math.floor((end_date - start_date)/100))/10 +' secs]</div></div>';

				
				//	$('infoQueryStatusText').innerHTML += '<div style="clear:both;"><div style="float:left; font-weight:bold">Finished Query: "'+queryName+'"</div><div style="margin-left:20px; clear:both; height:16px; line-height:16px; "><div height:16px; line-height:16px; ">Compute Time: ' + (Math.floor((end_date - start_date)/100))/10 + ' secs</div></div>';
						
						
					i2b2.CRC.ajax.getQueryResultInstanceList_fromQueryInstanceId("CRC:QueryTool", {qi_key_value: qi_id}, scopedCallbackQRS);
				}

			}
		}
	
	
				// this is a private function that is used by all QueryStatus object instances to check their status
		// callback processor to check the Query Instance
		var scopedCallbackQRSI = new i2b2_scopedCallback();
		scopedCallbackQRSI.scope = this;
		scopedCallbackQRSI.callback = function(results) {
			if (results.error) {
				alert(results.errorMsg);
				return;
			} else {
				// find our query instance

				var ri_list = results.refXML.getElementsByTagName('query_result_instance');
				var l = ri_list.length;
				for (var i=0; i<l; i++) {
					var temp = ri_list[i];
					var description = i2b2.h.XPath(temp, 'descendant-or-self::description')[0].firstChild.nodeValue;
					$('infoQueryStatusText').innerHTML += "<div style=\"clear: both;   padding-top: 10px; font-weight: bold;\">" + description + "</div>";					

				} 
				var crc_xml = results.refXML.getElementsByTagName('crc_xml_result');
				l = crc_xml.length;
				for (var i=0; i<l; i++) {			
					var temp = crc_xml[i];
					var xml_value = i2b2.h.XPath(temp, 'descendant-or-self::xml_value')[0].firstChild.nodeValue;

					var xml_v = i2b2.h.parseXml(xml_value);	
						
						
						i2b2.PM.model.userRoles.indexOf("DATA_LDS") == -1
						//	var proj_data = i2b2.PM.view.admin.currentProject;

					var params = i2b2.h.XPath(xml_v, 'descendant::data[@column]/text()/..');
					for (var i2 = 0; i2 < params.length; i2++) {
						var name = params[i2].getAttribute("name");
					//	$('infoQueryStatusText').innerHTML += "<div style=\"margin-left: 20px; clear: both; height: 16px; line-height: 16px;\">";
						$('infoQueryStatusText').innerHTML += "<div style=\"clear: both; margin-left: 20px; float: left; height: 16px; line-height: 16px;\">" + params[i2].getAttribute("column") +  ": <font color=\"#0000dd\">" + params[i2].firstChild.nodeValue + "" +  (i2b2.PM.model.userRoles.indexOf("DATA_LDS") == -1 ? "&plusmn;3" : "")  +   "</font></div>";
					//$('infoQueryStatusText').innerHTML += "</div>";						//i2b2.h.XPath(newxml, 'descendant-or-self::result/data')[0].firstChild.nodeValue;

					}


					var ri_id = i2b2.h.XPath(temp, 'descendant-or-self::result_instance_id')[0].firstChild.nodeValue;
						
			
				}
			}
		}
		
		// callback processor to check the Query Result Set
		var scopedCallbackQRS = new i2b2_scopedCallback();
		scopedCallbackQRS.scope = this;
		scopedCallbackQRS.callback = function(results) {
			if (results.error) {
				alert(results.errorMsg);
				return;
			} else {
				// find our query instance
				var qrs_list = results.refXML.getElementsByTagName('query_result_instance');
				var l = qrs_list.length;
				var resultStr = "";
				for (var i=0; i<l; i++) {
					var temp = qrs_list[i];
					var qrs_id = i2b2.h.XPath(temp, 'descendant-or-self::result_instance_id')[0].firstChild.nodeValue;
					if (QRS.hasOwnProperty(qrs_id)) {
						var rec = QRS[qrs_id];
					} else {
						var rec = new Object();
						rec.QRS_ID = qrs_id;
			//			resultStr += i2b2.h.getXNodeVal(temp, 'description');
			//			resultStr += i2b2.h.XPath(temp, 'descendant-or-self::query_status_type/name')[0].firstChild.nodeValue;
			//			resultStr += "<br/>";
						rec.QRS_DisplayType = i2b2.h.XPath(temp, 'descendant-or-self::query_result_type/display_type')[0].firstChild.nodeValue;
						rec.QRS_Type = i2b2.h.XPath(temp, 'descendant-or-self::query_result_type/name')[0].firstChild.nodeValue;
						rec.QRS_Description = i2b2.h.XPath(temp, 'descendant-or-self::description')[0].firstChild.nodeValue;
						rec.QRS_TypeID = i2b2.h.XPath(temp, 'descendant-or-self::query_result_type/result_type_id')[0].firstChild.nodeValue;
					}
					rec.QRS_Status = i2b2.h.XPath(temp, 'descendant-or-self::query_status_type/name')[0].firstChild.nodeValue;
					rec.QRS_Status_ID = i2b2.h.XPath(temp, 'descendant-or-self::query_status_type/status_type_id')[0].firstChild.nodeValue;
					// create execution time string
					QRS[rec.QRS_ID] = rec;
					
					if (rec.QRS_DisplayType == "CATNUM") {
						

						i2b2.CRC.ajax.getQueryResultInstanceList_fromQueryResultInstanceId("CRC:QueryTool", {qr_key_value: rec.QRS_ID}, scopedCallbackQRSI);
					} else if (rec.QRS_DisplayType == "LIST") {
						$('infoQueryStatusText').innerHTML += "<div style=\"clear: both; padding-top: 10px; font-weight: bold;\">" + rec.QRS_Description + "</div>";
					}


				}
				//	$('infoQueryStatusText').innerHTML = resultStr;

			}
		}
		
			

		
			
		//first get instance id 
		i2b2.CRC.ajax.getQueryInstanceList_fromQueryMasterId("CRC:QueryTool", {qm_key_value: queryMasterId}, scopedCallbackQI);	
		
		//if (qi_id != "") {
//			i2b2.CRC.ajax.getQueryResultInstanceList_fromQueryInstanceId("CRC:QueryTool", {qi_key_value: qi_id}, scopedCallbackQRS);
//			for (var q in QRS) {
//				i2b2.CRC.ajax.getQueryResultInstanceList_fromQueryResultInstanceId("CRC:QueryTool", {qr_key_value: QRS[q].QRS_ID}, scopedCallbackQRSI);
//			}		
		//}

	}

// ================================================================================================== //
	this.doScrollFirst = function() {
		this.doShowFrom(0);
	}

// ================================================================================================== //
	this.doScrollPrev = function() {
		var i = this.panelControllers[0].panelCurrentIndex - 1;
		if (i<0) { i=0; }
		this.doShowFrom(i);
	}

// ================================================================================================== //
	this.doScrollNext = function() {
		var i = this.panelControllers[0].panelCurrentIndex + 1;
		var dm = i2b2.CRC.model.queryCurrent;
		if (i > (dm.panels.length-3)) { i=dm.panels.length-3; }
		this.doShowFrom(i);
	}

// ================================================================================================== //
	this.doScrollLast = function() {
		var i = i2b2.CRC.model.queryCurrent.panels.length - 3;
		if (i<0) { i = 0; }
		this.doShowFrom(i);
	}

// ================================================================================================== //
	this.doScrollNew = function() {
		var i = i2b2.CRC.model.queryCurrent.panels.length - 2;
		if (i<0) { i = 0; }
		this.doShowFrom(i);
	}

// ================================================================================================== //
	this._redrawScrollBtns = function() {
		// enable & disable scroll buttons (at least the look of the buttons)
		var dir = i2b2.hive.cfg.urlFramework + 'cells/CRC/assets/';
		if (i2b2.CRC.ctrlr.QT.panelControllers[0].panelCurrentIndex == 0) {
			$('panelScrollFirst').src = dir+"QryTool_b_first_hide.gif";
			$('panelScrollPrev').src = dir+"QryTool_b_prev_hide.gif";
		} else {
			$('panelScrollFirst').src = dir+"QryTool_b_first.gif";
			$('panelScrollPrev').src = dir+"QryTool_b_prev.gif";
		}
		if ((i2b2.CRC.model.queryCurrent.panels.length - i2b2.CRC.ctrlr.QT.panelControllers[0].panelCurrentIndex) > 3) {
			$('panelScrollNext').src = dir+"QryTool_b_next.gif";
			$('panelScrollLast').src = dir+"QryTool_b_last.gif";
		} else {
			$('panelScrollNext').src = dir+"QryTool_b_next_hide.gif";
			$('panelScrollLast').src = dir+"QryTool_b_last_hide.gif";
		}
	},
// =====================================================================================================//
	/***************
	 * Print Query
	 ****************/
	this.doPrintQuery = function() {
		var v_cnt_panels = i2b2.CRC.model.queryCurrent.panels.length;
		var v_i2b2_quey_name = i2b2.CRC.model.queryCurrent.name;
		
		
		var crc_bcgrnd1 = "<td style='border:1px solid #667788;'>";
		var crc_bcgrnd2 = "<td style='border:1px solid #667788;background:#7FFFD4'>";
		var crc_cur_bcgrnd = null;
		
		if(
		   (v_i2b2_quey_name == null) || 
		   (v_i2b2_quey_name == undefined) ||
		   (v_i2b2_quey_name.length == 0)
		){
			v_i2b2_quey_name = 'No Query Name is currently provided.';
		}
		
		if(v_cnt_panels > 0){
			var win_html_inner = 
			"<table style='border:1px solid #667788;width:700px;' cellpadding=3px>"+
			"<tbody>";

			
			
			//Get Query Name if available
			win_html_inner +=
			"<tr>"+
			"<td style='background:#6677AA none repeat scroll 0%;border:1px solid #667788;'>"+
			"<span style='color:#FFFFFF;font-weight:bold;font-family:arial,helvetica;font-size:13px;'>"+
			"Query Name: "+ v_i2b2_quey_name + "<br>Temporal Constraint: ";
				
			var v_querytiming = i2b2.CRC.ctrlr.QT.queryTiming;
			if  (v_querytiming == "ANY")
			{
					win_html_inner += "Treat all groups independently";
			} else if  (v_querytiming == "SAMEVISIT") {
					win_html_inner += "Selected groups occur in the same financial encounter";
			} else {
					win_html_inner +=  "Items Instance will be the same";
			}

			win_html_inner += "</span></td></tr>";
		
			//Get information for each query panel
			for(x =0; x < v_cnt_panels; x++){
				var v_dateTo 	= i2b2.CRC.model.queryCurrent.panels[x].dateTo;
				var v_dateFrom 	= i2b2.CRC.model.queryCurrent.panels[x].dateFrom;
				var v_exclude	= i2b2.CRC.model.queryCurrent.panels[x].exclude;
				var v_occurs	= i2b2.CRC.model.queryCurrent.panels[x].occurs;
				var v_timing	= i2b2.CRC.model.queryCurrent.panels[x].timing;
				var v_items 	= i2b2.CRC.model.queryCurrent.panels[x].items;
				
				if((x % 2) == 0){
					crc_cur_bcgrnd = crc_bcgrnd1;
				}
				else{
					crc_cur_bcgrnd = crc_bcgrnd2;
				}
				
				var v_strDateTo = null;
				var v_strDateFrom = null;
				//Handle JS Dates
				if((v_dateTo == null) ||
				   (v_dateTo == undefined)  ||
				   (v_dateTo == false)
				){
				  v_strDateTo = "none";				   
				}
				else{
				  v_strDateTo = 
				  	v_dateTo.Month +"/"+
				  	v_dateTo.Day  +"/" +
				  	v_dateTo.Year;
				}


				//QueryTiming
				if (v_querytiming == "ANY")
				{
						v_timing = "Treat Independently";
						
				} else if (v_querytiming == "SAMEVISIT")
				{
					if (v_timing == "ANY")
					{
						v_timing = "Treat Independently";							
					} else {
						v_timing = "Occurs in Same Encounter";													
					}
				} else 
				{
					if (v_timing == "ANY")
					{
						v_timing = "Treat Independently";							
					} else {
						v_timing = "Items Instance will be the same";													
					}
				}


				//Handle JS Dates
				if((v_dateFrom == null) ||
				   (v_dateFrom == undefined)  ||
				   (v_dateFrom == false)
				){
				  v_strDateFrom = "none";				   
				}
				else{
				  v_strDateFrom =
				  	v_dateFrom.Month +"/"+
				  	v_dateFrom.Day  +"/" +
				  	v_dateFrom.Year;
				}
				
				win_html_inner += 
				"<tr>"+
				crc_cur_bcgrnd;
				
				win_html_inner += 
				"<span style='color:black;font-weight:bold;font-family:arial,helvetica;font-size:12px;'>"+
				"Group "+ (x + 1)
				"</span></td></tr>";
				
				win_html_inner +=
				"<tr><td style='border:1px solid #667788;'>"+
				"<table width=100% cellpadding=2px cellspacing=0>"+
				"<tbody>"+
				"<tr style='border:1px solid #667788;'>"+
				"<td colspan=3>"+
				"<span style='color:black;font-weight:bold;font-family:arial,helvetica;font-size:11px;'>"+
				"&nbsp; Date From: &nbsp;</span>"+
				"<span style='color:black;font-weight:normal;font-family:arial,helvetica;font-size:11px;'>"+
				v_strDateFrom +
				"</span>"+
				"<span style='color:black;font-weight:normal;font-family:arial,helvetica;font-size:11px;'> </span>"+
				"<span style='color:black;font-weight:bold;font-family:arial,helvetica;font-size:11px;'>"+
				"&nbsp; Date To: &nbsp;</span>"+
				"<span style='color:black;font-weight:normal;font-family:arial,helvetica;font-size:11px;'>"+
				v_strDateTo +
				"</span>"+
				"<span style='color:black;font-weight:normal;font-family:arial,helvetica;font-size:11px;'> </span>"+
				"<!--Excluded-->"+
				"<span style='color:black;font-weight:bold;font-family:arial,helvetica;font-size:11px;'>"+
				"&nbsp; Excluded? &nbsp;</span>"+
				"<span style='color:black;font-weight:normal;font-family:arial,helvetica;font-size:11px;'>"+
				v_exclude +
				"</span>"+
				"<span style='color:black;font-weight:normal;font-family:arial,helvetica;font-size:11px;'> </span>"+
				"<span style='color:black;font-weight:bold;font-family:arial,helvetica;font-size:11px;'>"+
				"&nbsp; Occurs X times: &nbsp;</span>"+
				"<span style='color:black;font-weight:normal;font-family:arial,helvetica;font-size:11px;'>&gt; "+
				v_occurs +
				"</span>"+
				"<span style='color:black;font-weight:normal;font-family:arial,helvetica;font-size:11px;'> </span>"+
				"<span style='color:black;font-weight:bold;font-family:arial,helvetica;font-size:11px;'>"+
				"&nbsp; Temporal Constraint: &nbsp;</span>"+
				"<span style='color:black;font-weight:normal;font-family:arial,helvetica;font-size:11px;'>"+
				v_timing +
				"</span>"+				
				"</td>"+
				"</tr>";
				
				win_html_inner +=
				"<!--Header Columns-->"+
				"<tr>"+
					"<!--Path-->"+
					"<td width=40% style='background:#6677AA none repeat scroll 0%;align:center;border-left-style:solid;border-bottom-style:solid;border-top-style:solid;border-right-style:solid;'>"+
					"<span style='color:#FFFFFF;font-weight:bold;font-family:arial,helvetica;font-size:11px;'>Path</span>"+
					"</td>"+
					"<!--Concept-->"+
					"<td width=30% style='background:#6677AA none repeat scroll 0%;align:center;border-bottom-style:solid;border-top-style:solid;border-right-style:solid;'>"+
					"<span style='color:#FFFFFF;font-weight:bold;font-family:arial,helvetica;font-size:11px;'>Concept/Term</span>"+
					"</td>"+
					"<!--Other Information-->"+
					"<td width=30% style='background:#6677AA none repeat scroll 0%;align:center;border-bottom-style:solid;border-top-style:solid;border-right-style:solid;'>"+
					"<span style='color:#FFFFFF;font-weight:bold;font-family:arial,helvetica;font-size:11px;'>Other Information</span>"+
					"</td>"+
				"</tr>";
				
				win_html_inner +=
				"<!--Data Columns-->";
								
				for(n = 0; n < v_items.length; n++){
					//str_shrine_path = v_items[n].sdxInfo.sdxKeyValue;
					//Using tooltips
					str_shrine_path = v_items[n].origData.tooltip;
										
					win_html_inner += "<tr>";
					win_html_inner += 
						"<td width=40% style='align:center;border-left-style:solid;border-bottom-style:solid;border-right-style:solid;'>"+
						"<span style='color:black;font-weight:normal;font-family:arial,helvetica;font-size:11px;'>"+
						 str_shrine_path +
						"</span></td>";
					
					win_html_inner += 
						"<td width=30% style='align:center;solid;border-bottom-style:solid;border-right-style:solid;'>"+
						"<span style='color:black;font-weight:normal;font-family:arial,helvetica;font-size:11px;'>"+
						v_items[n].origData.name +
						"</span></td>";
					
   					win_html_inner += 
						"<td width=30% style='align:center;border-bottom-style:solid;border-right-style:solid;'>"+
						"<span style='color:black;font-weight:normal;font-family:arial,helvetica;font-size:11px;'>";
					if((v_items[n].LabValues == null) ||
					   (v_items[n].LabValues == undefined) ||
					   (v_items[n].LabValues.length <= 0)
					){
					   					
						win_html_inner += "&nbsp;";	
						
					}
					else{
						var v_lab_values = v_items[n].LabValues;
						
						var str_lab_values = "";
						
						
						if(v_lab_values.GeneralValueType == "NUMBER") {
							str_lab_values =
								v_lab_values.NumericOp +" : ";
								
								if((v_lab_values.ValueLow != null) ||
								   (v_lab_values.ValueLow != undefined)
								){
									str_lab_values +=
									v_lab_values.ValueLow + " - "+
									v_lab_values.ValueHigh;
								} else {
									str_lab_values +=
									v_lab_values.Value;
								}							
								str_lab_values += " "+ v_lab_values.UnitsCtrl;
						}
						//String
						else if((v_lab_values.ValueString != null) ||
							(v_lab_values.ValueString != undefined)
						){
							str_lab_values =
								"By String: "+
								v_lab_values.ValueString;
						}
						//Flag
						else if((v_lab_values.ValueFlag != null) ||
							(v_lab_values.ValueFlag != undefined)
						){
							var v_flag = "Normal";
							if(v_lab_values.ValueFlag == "H"){
							  v_flag = "High";
							}
							else if(v_lab_values.ValueFlag == "L"){
							  v_flag = "Low";
							}
						
							str_lab_values = 
							"By Flag: "+ v_flag;
						}
														
						win_html_inner += str_lab_values;
					}
					
										
					win_html_inner += "</span></td></tr>";
				}
				
				
				win_html_inner += "</tbody></table>";
				
			}
			
			
			win_html_inner += "</tbody></table>";
			
			//Query Status window
			var self = i2b2.CRC.ctrlr.currentQueryStatus;
			if(
			   (self != null) &&
			   (self != undefined) &&
			   (self.dispDIV != null) &&
			   (self.dispDIV != undefined)
			){
				win_html_inner += self.dispDIV.innerHTML;
				
			}
			
			var win = 
				window.open("",'shrinePrintWindow','width=800,height=750,menubar=yes,resizable=yes,scrollbars=yes');

			

			win.document.writeln('<div id="shrinePrintQueryPage">');
			win.document.writeln(win_html_inner);
			win.document.writeln('</div>');
		}
		else{
		  	alert("Currently no query is available for printing. \nPlease generate a query before clicking on [Print Query] button.");
		}
	}

}

console.timeEnd('execute time');
console.groupEnd();
