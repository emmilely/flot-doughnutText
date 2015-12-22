/* Flot plugin for rendering text inside of Flot doughnut (pie w/ radius) charts.

Licensed under the MIT license.
Created by Emily Dragon

The plugin supports these options:

	series: {
		pie: {
			innerText: {
				show: true | false   Default: false
				value: string of text to use instead of the calculated value
				valueFormat: currency | numeric | none   Default: numeric,
				valueDecimals: integer   Default: -1 - Number of decimal places to display in the center total
				preValueText: text to display before the value   Default: ""
				postValueText: text to display after the value   Default: "Total"
				maxFontSize: index of the maximum font size for any of the lines - CANNOT be higher than the max index of the font_sizes array   Default: 0
			}
		}
	}

*/



(function ($) {
	
	
	// Maximum redraw attempts when fitting text within the plot
	var REDRAW_ATTEMPTS = 10;
	
	var options = {
	    series: {
			pie: {
				innerText: {
					show: false,
					value: 'auto',
					valueFormat: 'numeric',
					valueDecimals: -1,
					preValueText: '',
					postValueText: 'Total',
					maxFontSize: 0
				}
			}
		}
	};
	
	
    function init(plot) {
	    var font_sizes = [72, 64, 48, 36, 24, 18, 14, 12, 10, 9, 8, 5, 2, 0];
	    
	    //Functionality for get_pie_center() was modified from functionality in jquery.flot.pie.js
        function get_pie_center(plot) {
            var options = plot.getOptions(),
            	canvas = plot.getCanvas(),
				target = $(canvas).parent(),
            	canvas_width = plot.getPlaceholder().width(),
				canvas_height = plot.getPlaceholder().height(),
				legend_width = target.children().filter(".legend").children().width() || 0,
				max_radius =  Math.min(canvas_width, canvas_height / options.series.pie.tilt) / 2,
				center_top = canvas_height / 2 + options.series.pie.offset.top,
				center_left = canvas_width / 2,
				inner_radius = options.series.pie.innerRadius > 1 ? options.series.pie.innerRadius : max_radius * options.series.pie.innerRadius;

			if (options.series.pie.offset.left == "auto") {
				if (options.legend.position.match("w")) {
					center_left += legend_width / 2;
				} else {
					center_left -= legend_width / 2;
				}
				if (center_left < max_radius) {
					center_left = max_radius;
				} else if (center_left > canvas_width - max_radius) {
					center_left = canvas_width - max_radius;
				}
			} else {
				center_left += options.series.pie.offset.left;
			}

			return { top: center_top, left: center_left, inner_radius: inner_radius };
        }
        
        
        function format_as_currency(n) {
            var options = plot.getOptions(),
	        	decimals = (options.series.pie.innerText.valueDecimals !== -1)
	        		? options.series.pie.innerText.valueDecimals
	        		: 2,
	        	total = n.toFixed(decimals);

            //For the regular expression, if there are 0 decimals, add a period at the end (this will later be removed)
            if (decimals === 0) {
                total = total + '.';
            }

            //Add the thousand place commas
            total = '$' + total.replace(/\d(?=(\d{3})+\.)/g, '$&,');

            //If a period was added remove it
            //Return the total
            return (decimals === 0)
				? total.replace('.', '')
				: total;
        }
		
		
		function format_as_numeric(n) {
			var parts = n.toString().split("."),
				options = plot.getOptions(),
				total = 0;
		    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
		    
		    total = parseFloat(parts.join("."));
		    return (options.series.pie.innerText.valueDecimals !== -1)
		    	? total.toFixed(options.series.pie.innerText.valueDecimals)
		    	: total;
		}
        
        
        function calculate_pie_total(plot) {
            //Add up all of the pie data points
            var chart_data = plot.getData(),
            	total = 0,
            	options = plot.getOptions();
            	
            chart_data.forEach(function(data_obj) {
	            total += data_obj.data[0][1] * 100000;
            });
            total = Math.floor(total) / 100000;
            
            //Format the total as dictated by the options
            switch(options.series.pie.innerText.valueFormat) {
	            case('numeric'):
	            	total = format_as_numeric(total);
	            	break;
	            case('currency'):
	            	total = format_as_currency(total);
	            	break;
            }
            
            //Return the results
            return total;
        }
        

        function set_text_font(newCtx, max_text_width, text, bold, max_font_size_index) {
	        //Make sure non-required parameters have a value
	        max_font_size_index = (typeof max_font_size_index !== 'undefined')
            	? max_font_size_index
            	: 0;
            	
	        var ctx = newCtx,
            	text_properties = { width: 0, height: 0, font_index: max_font_size_index, font: '14px Arial' };
            	
            //Determine the maximum font size allowed for the space and text given
            do {
	            var font_bold = (bold)
	            	? 'bold '
	            	: '';
	            text_properties.font_index++;
			    text_properties.font = font_bold + font_sizes[text_properties.font_index] + 'px Arial';
			    ctx.font = text_properties.font;
			    text_properties.height = ctx.measureText('m').width;
			    text_properties.width = ctx.measureText(text).width;
			} while (text_properties.width >= max_text_width);

			//Return the font index that was used as a reference
			return text_properties;
        }
        
        
        function draw_text_line(plot, newCtx, pie_center, max_text_width, text, vertical_offset, bold, start_font_index) {
	        //Make sure non-required parameters have a value
            vertical_offset = (typeof vertical_offset !== 'undefined')
            	? vertical_offset
            	: 0;
            
            bold = (bold)
            	? true
            	: false;
            	
            start_font_index = (typeof start_font_index !== 'undefined')
            	? start_font_index
            	: 0;

	        //Define all of the values needed for this function
	        var ctx = newCtx,
	        	text_properties = set_text_font(ctx, max_text_width, text, bold, start_font_index);
            
            //Set the line-specific text properties and render the text
            var offset = {
	            top: pie_center.top - vertical_offset,
	            left: pie_center.left - (text_properties.width / 2)
            }
            
            ctx.font = text_properties.font;
			ctx.fillText( text, offset.left, offset.top );
			
			//Return the font index that was used as a reference
			return text_properties;
        }
        
        
        function draw_text(plot, newCtx) {
	        var options = plot.getOptions(),
	        	pie_center = get_pie_center(plot),
            	max_text_width = (pie_center.inner_radius * 2) * 0.7,
            	pie_total = (options.series.pie.innerText.value == 'auto')
            		? calculate_pie_total(plot)
            		: options.series.pie.innerText.value,
            	max_text_font_index = options.series.pie.innerText.maxFontSize,
            	secondary_text_font_index = 0,
            	line_padding = 15;
	        


	        //Determine the properties of each line of text to find out how much they should be offset to be centered
	        var pre_text = options.series.pie.innerText.preValueText,
	        	post_text = options.series.pie.innerText.postValueText,
	        	text_properties = (max_text_font_index !== 0)
	        		? set_text_font(newCtx, max_text_width, pie_total, true, (max_text_font_index - 1))
	        		: set_text_font(newCtx, max_text_width, pie_total, true),
	        	pre_text_properties = set_text_font(newCtx, max_text_width, pre_text, false, text_properties.font_index),
	        	post_text_properties = set_text_font(newCtx, max_text_width, post_text, false, text_properties.font_index);
	        	
	        //Make sure that both lines of secondary text have the same font size (if applicable)
	        secondary_text_font_index = (pre_text != '' && post_text != '')
	        	? Math.max(pre_text_properties.font_index, post_text_properties.font_index)
	        	: Math.min(pre_text_properties.font_index, post_text_properties.font_index);
	        	
	        	
	        	
	        //Determine each line's vertical offset from the center of the doughnut
	        text_properties.vertical_offset = 0;
	        pre_text_properties.vertical_offset = 0;
	        post_text_properties.vertical_offset = 0;
	        
	        if (pre_text != '' && post_text != '') {
		        newCtx.textBaseline = 'middle';
		        var offset = (text_properties.height / 2) + line_padding;
		        pre_text_properties.vertical_offset = offset;
		        post_text_properties.vertical_offset = offset * -1;

	        } else if (pre_text != '') {
		        newCtx.textBaseline = 'top';
		        var total_height = text_properties.height + pre_text_properties.height;
		        pre_text_properties.vertical_offset = total_height / 2;
		        text_properties.vertical_offset = pre_text_properties.vertical_offset - pre_text_properties.height;
		        
		        console.log(pre_text_properties.height + ' ' + text_properties.height);
		        
	        } else if (post_text != '') {
		        newCtx.textBaseline = 'top';
		        var total_height = post_text_properties.height + line_padding + text_properties.height;
		        text_properties.vertical_offset = total_height / 2;
		        post_text_properties.vertical_offset = text_properties.vertical_offset - line_padding - text_properties.height;
		        
	        } else {
		        newCtx.textBaseline = 'middle';
	        }
	        	
	        	
	        
	        //Draw each line of text
	        draw_text_line(plot, newCtx, pie_center, max_text_width, pie_total, text_properties.vertical_offset, true, max_text_font_index);

			//Set the color of the secondary text
			newCtx.fillStyle = '#666666';

			//Add the secondary text if it exists
	        if (pre_text != '')
	        	draw_text_line(plot, newCtx, pie_center, max_text_width, pre_text, pre_text_properties.vertical_offset, false, secondary_text_font_index);
	        	
	        if (post_text != '')
	        	draw_text_line(plot, newCtx, pie_center, max_text_width, post_text, post_text_properties.vertical_offset, false, secondary_text_font_index);
        }
        


        plot.hooks.draw.push(function(plot, newCtx) {
			var options = plot.getOptions();
			if (options.series.pie.show && options.series.pie.innerRadius > 0 && options.series.pie.innerText.show) {
				draw_text(plot, newCtx);
			}
		});
        
    }


	//Add the plugin to Flot
    $.plot.plugins.push({
        init: init,
        options: options,
        name: "doughnutText",
        version: "0.1"
    });
    
    
})(jQuery);