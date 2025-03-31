package communicate.AI;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import java.util.Arrays;
import java.util.stream.Collectors;

@Converter(autoApply = true)
public class VectorConverter implements AttributeConverter<double[], String> {

    @Override
    public String convertToDatabaseColumn(double[] vector) {
        if (vector == null || vector.length == 0) {
            return null;
        }
        return Arrays.stream(vector)
                     .mapToObj(Double::toString)
                     .collect(Collectors.joining(","));
    }

    @Override
    public double[] convertToEntityAttribute(String dbData) {
        if (dbData == null || dbData.isEmpty()) {
            return new double[0];
        }
        return Arrays.stream(dbData.split(","))
                     .mapToDouble(Double::parseDouble)
                     .toArray();
    }
}
